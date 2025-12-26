import { Snapshot, Knobs, MissionId, StageMetric } from "@/types";
import {
    LineageGraph,
    LineageNode,
    LineageEdge,
    LineageNodeType,
    ColumnLineage,
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

// Generate column-level lineage for Spark-like operations
function generateColumnLineage(
    _stage: StageMetric,
    nodeType: LineageNodeType,
    missionId: MissionId
): { name: string; type: string }[] {
    // Return realistic Spark columns based on stage type and mission
    const baseColumns: { name: string; type: string }[] = [];

    switch (nodeType) {
        case "source":
            if (missionId === "etl_joins" || missionId === "multi_join") {
                return [
                    { name: "customer_id", type: "bigint" },
                    { name: "order_id", type: "bigint" },
                    { name: "product_id", type: "bigint" },
                    { name: "amount", type: "decimal(10,2)" },
                    { name: "timestamp", type: "timestamp" },
                    { name: "region", type: "string" },
                ];
            } else if (missionId === "cdc_merge") {
                return [
                    { name: "id", type: "bigint" },
                    { name: "name", type: "string" },
                    { name: "value", type: "decimal(10,2)" },
                    { name: "updated_at", type: "timestamp" },
                    { name: "_change_type", type: "string" },
                ];
            } else if (missionId === "wide_schema") {
                // Wide table with many columns
                const cols = [{ name: "id", type: "bigint" }];
                for (let i = 1; i <= 50; i++) {
                    cols.push({ name: `col_${i}`, type: "string" });
                }
                return cols;
            }
            return [
                { name: "id", type: "bigint" },
                { name: "value", type: "string" },
                { name: "timestamp", type: "timestamp" },
            ];

        case "join":
            return [
                { name: "customer_id", type: "bigint" },
                { name: "order_id", type: "bigint" },
                { name: "product_name", type: "string" },
                { name: "amount", type: "decimal(10,2)" },
                { name: "region", type: "string" },
            ];

        case "aggregate":
            return [
                { name: "region", type: "string" },
                { name: "total_amount", type: "decimal(20,2)" },
                { name: "count", type: "bigint" },
                { name: "avg_amount", type: "decimal(10,2)" },
            ];

        case "filter":
            // Filter retains same schema as input
            return baseColumns;

        case "project":
            if (missionId === "wide_schema") {
                // Projection reduces columns
                return [
                    { name: "id", type: "bigint" },
                    { name: "col_1", type: "string" },
                    { name: "col_2", type: "string" },
                    { name: "col_3", type: "string" },
                ];
            }
            return [
                { name: "id", type: "bigint" },
                { name: "value", type: "string" },
            ];

        default:
            return [];
    }
}

// Build column lineage tracking transformations
function buildColumnLineages(
    nodes: LineageNode[],
    _edges: LineageEdge[]
): Map<string, ColumnLineage[]> {
    const columnLineages = new Map<string, ColumnLineage[]>();

    nodes.forEach((node, index) => {
        const lineages: ColumnLineage[] = [];
        const columns = node.columns || [];

        columns.forEach((col) => {
            let sourceColumns: string[] = [];
            let transformation = "";

            // Determine source columns based on node type
            switch (node.type) {
                case "source":
                    // Source nodes have no upstream
                    sourceColumns = [];
                    transformation = "table scan";
                    break;

                case "join":
                    // Join combines columns from multiple sources
                    if (index > 0) {
                        const prevNode = nodes[index - 1];
                        sourceColumns = prevNode.columns?.map((c) => c.name) || [];
                    }
                    transformation = col.name.includes("id") ? "join key" : "passthrough";
                    break;

                case "aggregate":
                    // Aggregations create new columns
                    if (col.name.includes("total") || col.name.includes("sum")) {
                        sourceColumns = ["amount"];
                        transformation = "SUM(amount)";
                    } else if (col.name.includes("count")) {
                        sourceColumns = ["*"];
                        transformation = "COUNT(*)";
                    } else if (col.name.includes("avg")) {
                        sourceColumns = ["amount"];
                        transformation = "AVG(amount)";
                    } else {
                        sourceColumns = [col.name];
                        transformation = "GROUP BY";
                    }
                    break;

                case "filter":
                    // Filter passes through columns
                    sourceColumns = [col.name];
                    transformation = "filter predicate";
                    break;

                case "project":
                    // Project selects specific columns
                    sourceColumns = [col.name];
                    transformation = "column selection";
                    break;

                default:
                    sourceColumns = [col.name];
                    transformation = "passthrough";
            }

            lineages.push({
                columnName: col.name,
                sourceColumns,
                transformation,
                dataType: col.type,
            });
        });

        if (lineages.length > 0) {
            columnLineages.set(node.id, lineages);
        }
    });

    return columnLineages;
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
        const columns = generateColumnLineage(stage, nodeType, missionId);

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
            columns,
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

    // Build column lineages
    const columnLineages = buildColumnLineages(nodes, edges);

    return {
        missionId,
        nodes,
        edges,
        columnLineages,
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
