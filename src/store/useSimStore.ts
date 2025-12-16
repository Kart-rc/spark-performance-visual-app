
import { create } from "zustand";
import {
    Knobs,
    MissionId,
    Snapshot,

} from "@/types";
import { missions, defaultKnobs } from "@/data/missions";
import { simulate } from "@/lib/simulation";
import { ChatMessage, getGeminiResponse } from "@/lib/gemini";

interface SimState {
    missionId: MissionId | null;
    knobs: Knobs;
    snapshot: Snapshot;
    // Guide State
    guideMode: boolean;
    currentStep: number;
    learningMode: boolean;

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

    guideMode: false,
    learningMode: false,
    currentStep: 0,

    isGeminiOpen: true, // Default open for sidebar
    chatHistory: [],
    isTyping: false,

    setMission: (id) => {
        if (!id) {
            set({ missionId: null });
            return;
        }
        set({
            missionId: id,
            knobs: missions[id].initialKnobs,
            snapshot: simulate(id, missions[id].initialKnobs),
            guideMode: false,
            learningMode: false,
            currentStep: 0,
            chatHistory: [],
        });
    },
    setKnob: (key, value) => {
        const { missionId, knobs } = get();
        if (!missionId) return;
        const next = { ...knobs, [key]: value };
        set({ knobs: next, snapshot: simulate(missionId, next) });
    },

    startGuide: () => {
        const { missionId } = get();
        if (!missionId) return;
        set({
            guideMode: true,
            learningMode: false, // Mutual exclusive with guide? Maybe not strictly, but good for focus
            currentStep: 0,
            chatHistory: [{
                role: "model",
                text: "Welcome to the interactive guide! I'll walk you through optimizing this mission step-by-step. Ready to start?"
            }]
        });
    },

    toggleLearningMode: () => set((s) => ({ learningMode: !s.learningMode })),

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

        const newKnobs = { ...knobs, ...step.expectedKnobDiff };
        set({
            knobs: newKnobs,
            snapshot: simulate(missionId, newKnobs),
        });
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
        const response = await getGeminiResponse(text, { missionId, knobs, snap: snapshot });

        set((s) => ({
            chatHistory: [...s.chatHistory, { role: "model", text: response }],
            isTyping: false,
        }));
    },

    // Missing actions
    reset: () => {
        const { missionId } = get();
        if (!missionId) return;
        set({
            knobs: missions[missionId].initialKnobs,
            snapshot: simulate(missionId, missions[missionId].initialKnobs),
            currentStep: 0,
        });
    },
    compareBaseline: false,
    toggleCompare: () => set((s) => ({ compareBaseline: !s.compareBaseline })),
}));
