// OpenTelemetry and Lineage types

export type SpanStatus = "ok" | "error" | "unset";

export type OtelSpan = {
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    name: string;
    startTime: number;
    endTime: number;
    duration: number;
    status: SpanStatus;
    attributes: Record<string, string | number | boolean>;
    events: {
        name: string;
        timestamp: number;
        attributes?: Record<string, string | number | boolean>;
    }[];
};

export type OtelTrace = {
    traceId: string;
    spans: OtelSpan[];
    startTime: number;
    endTime: number;
    duration: number;
    rootSpan: OtelSpan;
};

// Lineage types
export type LineageNodeType =
    | "source"
    | "transformation"
    | "join"
    | "aggregate"
    | "filter"
    | "project"
    | "shuffle"
    | "cache"
    | "sink";

export type LineageNode = {
    id: string;
    type: LineageNodeType;
    name: string;
    stageId?: string;
    operation: string;
    metrics: {
        durationMs?: number;
        inputRecords?: number;
        outputRecords?: number;
        shuffleReadMB?: number;
        shuffleWriteMB?: number;
        spillMB?: number;
        skewScore?: number;
    };
    columns?: {
        name: string;
        type: string;
    }[];
    knobsAffecting: string[]; // Which knobs affect this node
    attributes: Record<string, string | number | boolean>;
};

export type LineageEdge = {
    id: string;
    source: string;
    target: string;
    type: "data_flow" | "shuffle" | "broadcast";
    label?: string;
    metrics?: {
        dataSizeMB?: number;
        recordCount?: number;
    };
};

export type ColumnLineage = {
    columnName: string;
    sourceColumns: string[]; // Which columns from previous stage(s) contributed
    transformation?: string; // Description of transformation applied
    dataType: string;
};

export type LineageGraph = {
    missionId: string;
    nodes: LineageNode[];
    edges: LineageEdge[];
    columnLineages?: Map<string, ColumnLineage[]>; // nodeId -> column lineages
    metadata: {
        generatedAt: number;
        knobsSnapshot: Record<string, boolean | number>;
        totalDurationMs: number;
        criticalPath: string[]; // Node IDs on the critical path
    };
};
