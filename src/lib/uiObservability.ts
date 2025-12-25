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

const buildStaticScaLineage = (
    missionId: MissionId
): { nodes: LineageGraph["nodes"]; edges: LineageEdge[]; totalDurationMs: number } => {
    const prefix = `sca-${missionId}`;
    const nodes: LineageGraph["nodes"] = [
        {
            id: `${prefix}-entry`,
            type: "source",
            name: "App event captured",
            operation: "ui_instrumentation",
            metrics: { durationMs: 12 },
            knobsAffecting: [],
            attributes: {
                description: "UI interactions are wrapped with runUiAction for traceability.",
                traceId: "static-sca",
                staticDoc: true,
            },
            columns: [
                { name: "eventId", type: "string" },
                { name: "eventType", type: "string" },
                { name: "payload", type: "json" },
                { name: "timestamp", type: "long" },
            ],
        },
        {
            id: `${prefix}-state`,
            type: "transformation",
            name: "Update Zustand store",
            operation: "state_sync",
            metrics: { durationMs: 18 },
            knobsAffecting: [],
            attributes: {
                description: "Actions update mission state and tuning knobs in the store.",
                traceId: "static-sca",
                staticDoc: true,
            },
            columns: [
                { name: "missionState", type: "struct" },
                { name: "activeKnobs", type: "map<string, bool>" },
            ],
        },
        {
            id: `${prefix}-simulate`,
            type: "aggregate",
            name: "Simulate Spark plan",
            operation: "simulation",
            metrics: { durationMs: 24 },
            knobsAffecting: [],
            attributes: {
                description: "Simulation generates plan, metrics, and scorecard snapshots.",
                traceId: "static-sca",
                staticDoc: true,
            },
        },
        {
            id: `${prefix}-lineage`,
            type: "project",
            name: "Document SCA code flow",
            operation: "lineage_build",
            metrics: { durationMs: 16 },
            knobsAffecting: [],
            attributes: {
                description: "Lineage graph links UI actions to telemetry traces for the mission.",
                traceId: "static-sca",
                staticDoc: true,
            },
        },
        {
            id: `${prefix}-telemetry`,
            type: "sink",
            name: "Emit OpenTelemetry spans",
            operation: "telemetry",
            metrics: { durationMs: 10 },
            knobsAffecting: [],
            attributes: {
                description: "Actions are exported to the in-memory span buffer for the trace viewer.",
                traceId: "static-sca",
                staticDoc: true,
            },
        },
    ];

    const edges: LineageEdge[] = nodes.slice(0, -1).map((node, index) => ({
        id: `${node.id}-${nodes[index + 1].id}`,
        source: node.id,
        target: nodes[index + 1].id,
        type: "data_flow",
        label: "Static SCA flow",
    }));

    const totalDurationMs = nodes.reduce((acc, node) => acc + (node.metrics.durationMs ?? 0), 0);

    return { nodes, edges, totalDurationMs };
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

    const {
        nodes: staticNodes,
        edges: staticEdges,
        totalDurationMs: staticDurationMs,
    } = buildStaticScaLineage(missionId);

    const relevantInteractions = uiInteractions.filter(
        (interaction) => interaction.missionId === missionId
    );

    const sorted = relevantInteractions.sort((a, b) => a.startedAt - b.startedAt);

    const interactionNodes = sorted.map((interaction, index) => ({
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

    const interactionEdges: LineageEdge[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        interactionEdges.push({
            id: `${current.id}-${next.id}`,
            source: current.id,
            target: next.id,
            type: "data_flow",
        });
    }

    const nodes = [...staticNodes, ...interactionNodes];

    const edges: LineageEdge[] = [
        ...staticEdges,
        ...(interactionNodes.length > 0
            ? [
                  {
                      id: `${staticNodes[staticNodes.length - 1].id}-${interactionNodes[0].id}`,
                      source: staticNodes[staticNodes.length - 1].id,
                      target: interactionNodes[0].id,
                      type: "data_flow" as const,
                      label: "User action lineage",
                  },
                  ...interactionEdges,
              ]
            : []),
    ];

    const criticalPath = [...nodes]
        .sort((a, b) => (b.metrics.durationMs ?? 0) - (a.metrics.durationMs ?? 0))
        .slice(0, Math.min(5, nodes.length))
        .map((node) => node.id);

    const interactionDuration = sorted.reduce((acc, interaction) => acc + interaction.durationMs, 0);
    const totalDurationMs = staticDurationMs + interactionDuration;

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
