
import { create } from "zustand";
import {
    Knobs,
    MissionId,
    Snapshot,

} from "@/types";
import { missions, defaultKnobs } from "@/data/missions";
import { simulate } from "@/lib/simulation";
import { ChatMessage, getGeminiResponse } from "@/lib/gemini";
import { extractMetricValue } from "@/lib/metricAnalysis";
import { LineageGraph } from "@/types/telemetry";
import {
    buildUiLineageGraph,
    resetUiObservability,
    runUiAction,
    runUiActionAsync,
} from "@/lib/uiObservability";

interface SimState {
    missionId: MissionId | null;
    knobs: Knobs;
    snapshot: Snapshot;
    // Guide State
    guideMode: boolean;
    currentStep: number;
    learningMode: boolean;
    setCurrentStep: (idx: number) => void;

    // Baseline metrics for comparison
    baselineMetrics: {
        shuffle: number;
        spill: number;
        duration: number;
        skew: number;
        fileImpact: number;
        gc: number;
    } | null;

    // Lineage tracking
    lineageGraph: LineageGraph | null;

    // Gemini State
    isGeminiOpen: boolean; // Keep for now if we want to toggle visibility, though it's always visible in sidebar
    chatHistory: ChatMessage[];
    isTyping: boolean;

    setMission: (id: MissionId | null) => void;
    setKnob: (key: keyof Knobs, value: boolean | number) => void;

    // Guide Actions
    startGuide: () => void;
    toggleLearningMode: () => void;
    nextStep: () => void;
    prevStep: () => void;
    applyStep: () => void;
    applyStepByIndex: (idx: number) => void;

    // Gemini Actions
    toggleGemini: () => void;
    sendGeminiMessage: (text: string) => Promise<void>;

    // Missing actions
    reset: () => void;
    compareBaseline: boolean;
    toggleCompare: () => void;
}

export const useSimStore = create<SimState>((set, get) => ({
    missionId: null,
    knobs: defaultKnobs,
    snapshot: simulate("etl_joins", defaultKnobs),
    baselineMetrics: null,
    lineageGraph: null,

    guideMode: false,
    learningMode: false,
    currentStep: 0,

    setCurrentStep: (idx) =>
        set((s) => ({
            currentStep: Math.min(
                Math.max(idx, 0),
                s.missionId ? missions[s.missionId].coachSteps.length : 0
            ),
        })),

    isGeminiOpen: true, // Default open for sidebar
    chatHistory: [],
    isTyping: false,

    setMission: (id) => {
        if (!id) {
            resetUiObservability();
            set({ missionId: null, baselineMetrics: null, lineageGraph: null });
            return;
        }

        const currentMission = get().missionId;
        if (currentMission && currentMission !== id) {
            resetUiObservability();
        }

        // Capture baseline metrics
        const baseline = simulate(id, missions[id].baselineKnobs);
        const baselineMetrics = {
            shuffle: extractMetricValue(baseline, "shuffle"),
            spill: extractMetricValue(baseline, "spill"),
            duration: baseline.scorecard.runtimeMin,
            skew: extractMetricValue(baseline, "skew"),
            fileImpact: baseline.scorecard.fileImpactPct ?? 0,
            gc: extractMetricValue(baseline, "gc"),
        };

        runUiAction(
            "Select mission",
            "mission_select",
            id,
            { missionId: id },
            () => {
                const initialSnapshot = simulate(id, missions[id].initialKnobs);
                set({
                    missionId: id,
                    knobs: missions[id].initialKnobs,
                    snapshot: initialSnapshot,
                    baselineMetrics,
                    guideMode: false,
                    learningMode: false,
                    currentStep: 0,
                    chatHistory: [],
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(id) });
    },
    setKnob: (key, value) => {
        const { missionId, knobs } = get();
        if (!missionId) return;

        runUiAction(
            "Update tuning knob",
            "knob_change",
            missionId,
            { knob: key, value },
            () => {
                const next = { ...knobs, [key]: value };
                const snapshot = simulate(missionId, next);
                set({
                    knobs: next,
                    snapshot,
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },

    startGuide: () => {
        const { missionId } = get();
        if (!missionId) return;
        runUiAction(
            "Start coach mode",
            "learning_toggle",
            missionId,
            { missionId },
            () => {
                set({
                    guideMode: true,
                    learningMode: true,
                    currentStep: 0,
                    chatHistory: [{
                        role: "model",
                        text: "Welcome to the interactive guide! I'll walk you through optimizing this mission step-by-step. Ready to start?"
                    }]
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },

    toggleLearningMode: () => {
        const missionId = get().missionId;
        if (!missionId) return;
        runUiAction(
            "Toggle learning mode",
            "learning_toggle",
            missionId,
            { missionId },
            () => set((s) => ({ learningMode: !s.learningMode }))
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },

    nextStep: () =>
        set((s) => ({
            currentStep: Math.min(
                s.currentStep + 1,
                s.missionId ? missions[s.missionId].coachSteps.length : 0
            ),
        })),

    prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),

    applyStep: () => {
        const { missionId, currentStep, knobs } = get();
        if (!missionId) return;
        const step = missions[missionId].coachSteps[currentStep];
        if (!step) return;

        runUiAction(
            "Apply guide step",
            "guide_step",
            missionId,
            { stepIndex: currentStep },
            () => {
                const newKnobs = { ...knobs, ...step.expectedKnobDiff };
                const snapshot = simulate(missionId, newKnobs);
                set({
                    knobs: newKnobs,
                    snapshot,
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },

    applyStepByIndex: (idx) => {
        const { missionId, knobs } = get();
        if (!missionId) return;
        const step = missions[missionId].coachSteps[idx];
        if (!step) return;

        runUiAction(
            "Jump to guide step",
            "guide_step",
            missionId,
            { stepIndex: idx },
            () => {
                const newKnobs = { ...knobs, ...step.expectedKnobDiff };
                const snapshot = simulate(missionId, newKnobs);
                set({
                    knobs: newKnobs,
                    snapshot,
                    currentStep: idx,
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },

    toggleGemini: () => set((s) => ({ isGeminiOpen: !s.isGeminiOpen })),

    sendGeminiMessage: async (text) => {
        const { missionId, knobs, snapshot, chatHistory } = get();
        if (!missionId) return;

        // Add user message
        set({
            chatHistory: [...chatHistory, { role: "user", text }],
            isTyping: true,
        });

        // Get response
        try {
            const response = await runUiActionAsync(
                "Gemini message",
                "gemini_message",
                missionId,
                { missionId, textLength: text.length },
                () => getGeminiResponse(text, { missionId, knobs, snap: snapshot })
            );

            set((s) => ({
                chatHistory: [...s.chatHistory, { role: "model", text: response }],
                isTyping: false,
                lineageGraph: buildUiLineageGraph(missionId),
            }));
        } catch (error) {
            set({
                isTyping: false,
                lineageGraph: buildUiLineageGraph(missionId),
            });
            throw error;
        }
    },

    // Missing actions
    reset: () => {
        const { missionId } = get();
        if (!missionId) return;
        runUiAction(
            "Reset mission state",
            "plan_reset",
            missionId,
            { missionId },
            () => {
                const snapshot = simulate(missionId, missions[missionId].initialKnobs);
                set({
                    knobs: missions[missionId].initialKnobs,
                    snapshot,
                    currentStep: 0,
                });
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },
    compareBaseline: false,
    toggleCompare: () => {
        const missionId = get().missionId;
        if (!missionId) return;
        runUiAction(
            "Toggle baseline comparison",
            "compare_toggle",
            missionId,
            { missionId },
            () => {
                set((s) => ({
                    compareBaseline: !s.compareBaseline,
                }));
            }
        );
        set({ lineageGraph: buildUiLineageGraph(missionId) });
    },
}));
