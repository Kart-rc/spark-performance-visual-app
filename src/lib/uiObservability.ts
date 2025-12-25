import { SpanStatusCode } from "@opentelemetry/api";
import { tracer } from "@/lib/telemetry";
import { LineageEdge, LineageGraph, LineageNodeType } from "@/types/telemetry";
import { MissionId } from "@/types";

type UiActionType =
    | "mission_select"
    | "knob_change"
    | "guide_step"
    | "gemini_message"
    | "plan_reset"
    | "compare_toggle"
    | "learning_toggle";

type UiInteraction = {
    id: string;
    action: UiActionType;
    name: string;
    missionId: MissionId | null;
    startedAt: number;
    durationMs: number;
    traceId: string;
    attributes: Record<string, string | number | boolean>;
};

const uiInteractions: UiInteraction[] = [];

const actionNodeTypeMap: Record<UiActionType, LineageNodeType> = {
    mission_select: "source",
    knob_change: "filter",
    guide_step: "project",
    gemini_message: "aggregate",
    plan_reset: "sink",
    compare_toggle: "shuffle",
    learning_toggle: "transformation",
};

const getNodeType = (action: UiActionType): LineageNodeType =>
    actionNodeTypeMap[action] ?? "transformation";

const recordInteraction = (interaction: UiInteraction) => {
    uiInteractions.push(interaction);
};

export const resetUiObservability = () => {
    uiInteractions.length = 0;
};

export const runUiAction = <T>(
    name: string,
    action: UiActionType,
    missionId: MissionId | null,
    attributes: Record<string, string | number | boolean>,
    fn: () => T
): T => {
    const startedAt = performance.now();
    const span = tracer.startSpan(name);
    span.setAttribute("app.action", action);
    if (missionId) {
        span.setAttribute("app.mission", missionId);
    }
    Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(`app.${key}`, value);
    });

    try {
        const result = fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (error) {
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
    } finally {
        const durationMs = performance.now() - startedAt;
        const context = span.spanContext();
        recordInteraction({
            id: context.spanId,
            traceId: context.traceId,
            action,
            name,
            missionId,
            startedAt: Date.now() - durationMs,
            durationMs,
            attributes,
        });
        span.end();
    }
};

export const runUiActionAsync = async <T>(
    name: string,
    action: UiActionType,
    missionId: MissionId | null,
    attributes: Record<string, string | number | boolean>,
    fn: () => Promise<T>
): Promise<T> => {
    const startedAt = performance.now();
    return tracer.startActiveSpan(name, async (span) => {
        span.setAttribute("app.action", action);
        if (missionId) {
            span.setAttribute("app.mission", missionId);
        }
        Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(`app.${key}`, value);
        });

        try {
            const result = await fn();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error),
            });
            span.recordException(error as Error);
            throw error;
        } finally {
            const durationMs = performance.now() - startedAt;
            const context = span.spanContext();
            recordInteraction({
                id: context.spanId,
                traceId: context.traceId,
                action,
                name,
                missionId,
                startedAt: Date.now() - durationMs,
                durationMs,
                attributes,
            });
            span.end();
        }
    });
};

export const buildUiLineageGraph = (missionId: MissionId | null): LineageGraph | null => {
    if (!missionId) return null;

    const relevantInteractions = uiInteractions.filter(
        (interaction) => interaction.missionId === missionId
    );

    if (relevantInteractions.length === 0) return null;

    const sorted = relevantInteractions.sort((a, b) => a.startedAt - b.startedAt);

    const nodes = sorted.map((interaction, index) => ({
        id: interaction.id,
        type: getNodeType(interaction.action),
        name: interaction.name,
        operation: interaction.action,
        metrics: {
            durationMs: interaction.durationMs,
        },
        knobsAffecting: interaction.attributes.knob
            ? [String(interaction.attributes.knob)]
            : [],
        attributes: {
            ...interaction.attributes,
            order: index,
            traceId: interaction.traceId,
        },
    }));

    const edges: LineageEdge[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        edges.push({
            id: `${current.id}-${next.id}`,
            source: current.id,
            target: next.id,
            type: "data_flow",
        });
    }

    const criticalPath = [...sorted]
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, Math.min(5, sorted.length))
        .map((interaction) => interaction.id);

    const totalDurationMs = sorted.reduce((acc, interaction) => acc + interaction.durationMs, 0);

    return {
        missionId,
        nodes,
        edges,
        metadata: {
            generatedAt: Date.now(),
            knobsSnapshot: { interactionCount: sorted.length },
            totalDurationMs,
            criticalPath,
        },
    };
};
