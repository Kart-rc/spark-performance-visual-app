import { Snapshot, Knobs, MissionId, StageMetric } from "@/types";
import {
    LineageGraph,
    LineageNode,
    LineageEdge,
    LineageNodeType,
} from "@/types/telemetry";

// Helper to infer operation type from stage name
function inferNodeType(stageName: string): LineageNodeType {
    const lower = stageName.toLowerCase();
    if (lower.includes("scan") || lower.includes("read")) return "source";
    if (lower.includes("join")) return "join";
    if (lower.includes("agg") || lower.includes("aggregate")) return "aggregate";
    if (lower.includes("filter") || lower.includes("dedup")) return "filter";
    if (lower.includes("write") || lower.includes("rewrite")) return "sink";
    if (lower.includes("cache")) return "cache";
    if (lower.includes("exchange") || lower.includes("shuffle")) return "shuffle";
    if (lower.includes("project") || lower.includes("parse")) return "project";
    return "transformation";
}

// Helper to determine which knobs affect a stage
function getAffectingKnobs(
    stage: StageMetric,
    missionId: MissionId,
    knobs: Knobs
): string[] {
    const affecting: string[] = [];

    // Shared knobs
    if (knobs.aqe) affecting.push("aqe");
    if (knobs.projectEarly) affecting.push("projectEarly");
    if (knobs.filterEarly) affecting.push("filterEarly");
    if (knobs.repartition) affecting.push("repartition");
    if (knobs.coalesce) affecting.push("coalesce");

    // Join-related stages
    if (stage.name.toLowerCase().includes("join")) {
        if (knobs.broadcastCustomers) affecting.push("broadcastCustomers");
        if (knobs.optimizeJoinOrder) affecting.push("optimizeJoinOrder");
    }

    // Cache-related stages
    if (stage.name.toLowerCase().includes("cache") || stage.id.includes("c")) {
        if (knobs.cacheAfterClean) affecting.push("cacheAfterClean");
    }

    // MERGE/CDC specific
    if (missionId === "cdc_merge") {
        if (knobs.preDedupCdc && stage.id === "m2") affecting.push("preDedupCdc");
        if (knobs.updateOnlyChangedCols && stage.id === "m4")
            affecting.push("updateOnlyChangedCols");
        if (knobs.optimizeBeforeMerge && stage.id === "m3")
            affecting.push("optimizeBeforeMerge");
        if (knobs.zOrderOnKeys && stage.id === "m3") affecting.push("zOrderOnKeys");
    }

    // Small files specific
    if (missionId === "small_files") {
        if (knobs.optimizeBeforeMerge) affecting.push("optimizeBeforeMerge");
        if (knobs.zOrderOnKeys) affecting.push("zOrderOnKeys");
    }

    // DPP specific
    if (missionId === "dpp_tuning" && knobs.dynamicPruning && stage.id === "d1") {
        affecting.push("dynamicPruning");
    }

    // UDF specific
    if (missionId === "udf_native" && stage.id === "u2" && !knobs.useUdf) {
        affecting.push("useUdf");
    }

    return affecting;
}

// Build lineage graph from snapshot
export function buildLineageGraph(
    missionId: MissionId,
    snapshot: Snapshot,
    knobs: Knobs
): LineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    // Create nodes for each stage
    snapshot.stages.forEach((stage, index) => {
        const nodeType = inferNodeType(stage.name);
        const node: LineageNode = {
            id: stage.id,
            type: nodeType,
            name: stage.name,
            stageId: stage.id,
            operation: stage.name,
            metrics: {
                durationMs: stage.durationMs,
                shuffleReadMB: stage.shuffleReadMB,
                shuffleWriteMB: stage.shuffleWriteMB,
                spillMB: stage.spillMB,
                skewScore: stage.skewScore,
            },
            knobsAffecting: getAffectingKnobs(stage, missionId, knobs),
            attributes: {
                stageIndex: index,
                gcMs: stage.gcMs,
                skewScore: stage.skewScore,
            },
        };
        nodes.push(node);
    });

    // Create edges between stages
    for (let i = 0; i < nodes.length - 1; i++) {
        const source = nodes[i];
        const target = nodes[i + 1];

        // Determine edge type
        let edgeType: "data_flow" | "shuffle" | "broadcast" = "data_flow";
        let dataSizeMB = 0;

        if (target.metrics.shuffleReadMB && target.metrics.shuffleReadMB > 0) {
            edgeType = "shuffle";
            dataSizeMB = target.metrics.shuffleReadMB;
        } else if (source.name.toLowerCase().includes("broadcast")) {
            edgeType = "broadcast";
        }

        const edge: LineageEdge = {
            id: `${source.id}-${target.id}`,
            source: source.id,
            target: target.id,
            type: edgeType,
            label: edgeType === "shuffle" ? `${dataSizeMB.toFixed(0)} MB` : undefined,
            metrics: {
                dataSizeMB,
            },
        };
        edges.push(edge);
    }

    // Calculate critical path (stages with highest duration)
    const criticalPath = [...nodes]
        .sort((a, b) => (b.metrics.durationMs || 0) - (a.metrics.durationMs || 0))
        .slice(0, Math.ceil(nodes.length / 2))
        .map((n) => n.id);

    return {
        missionId,
        nodes,
        edges,
        metadata: {
            generatedAt: Date.now(),
            knobsSnapshot: { ...knobs },
            totalDurationMs: snapshot.stages.reduce((sum, s) => sum + s.durationMs, 0),
            criticalPath,
        },
    };
}

// Get lineage diff between two graphs (for comparison)
export function compareLineageGraphs(
    before: LineageGraph,
    after: LineageGraph
): {
    nodeChanges: {
        id: string;
        name: string;
        durationChange: number;
        shuffleChange: number;
    }[];
    edgeChanges: {
        id: string;
        dataSizeChange: number;
    }[];
} {
    const nodeChanges: any[] = [];
    const edgeChanges: any[] = [];

    // Compare nodes
    before.nodes.forEach((beforeNode) => {
        const afterNode = after.nodes.find((n) => n.id === beforeNode.id);
        if (afterNode) {
            const durationChange =
                (afterNode.metrics.durationMs || 0) - (beforeNode.metrics.durationMs || 0);
            const shuffleChange =
                ((afterNode.metrics.shuffleReadMB || 0) +
                    (afterNode.metrics.shuffleWriteMB || 0)) -
                ((beforeNode.metrics.shuffleReadMB || 0) +
                    (beforeNode.metrics.shuffleWriteMB || 0));

            if (Math.abs(durationChange) > 100 || Math.abs(shuffleChange) > 10) {
                nodeChanges.push({
                    id: beforeNode.id,
                    name: beforeNode.name,
                    durationChange,
                    shuffleChange,
                });
            }
        }
    });

    // Compare edges
    before.edges.forEach((beforeEdge) => {
        const afterEdge = after.edges.find((e) => e.id === beforeEdge.id);
        if (afterEdge) {
            const dataSizeChange =
                (afterEdge.metrics?.dataSizeMB || 0) -
                (beforeEdge.metrics?.dataSizeMB || 0);

            if (Math.abs(dataSizeChange) > 10) {
                edgeChanges.push({
                    id: beforeEdge.id,
                    dataSizeChange,
                });
            }
        }
    });

    return { nodeChanges, edgeChanges };
}
