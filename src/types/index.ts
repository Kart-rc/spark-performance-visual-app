export type MissionId =
    | "etl_joins"
    | "cdc_merge"
    | "skew_tail"
    | "small_files"
    | "cache_spill"
    | "dpp_tuning"
    | "udf_native"
    | "wide_schema"
    | "multi_join";

export type Knobs = {
    aqe: boolean;
    dynamicPruning: boolean;

    // Join-ish knobs
    broadcastCustomers: boolean;
    broadcastThresholdMB: number;

    // Caching (shown for join missions and small-files lesson)
    cacheAfterClean: boolean;

    // Delta layout knobs (merge + small files)
    optimizeBeforeMerge: boolean;
    zOrderOnKeys: boolean;

    // MERGE knobs
    preDedupCdc: boolean;
    updateOnlyChangedCols: boolean;

    // Query patterns (shared)
    projectEarly: boolean;
    filterEarly: boolean;

    // Mission 7: UDF
    useUdf: boolean;

    // Mission 9: Join Order
    optimizeJoinOrder: boolean;
};

export type StageMetric = {
    id: string;
    name: string;
    durationMs: number;
    shuffleReadMB: number;
    shuffleWriteMB: number;
    spillMB: number;
    gcMs: number;
    skewScore: number; // 0..1
};

export type Scorecard = {
    runtimeMin: number;
    costUnits: number;
    slaRisk: "low" | "medium" | "high";
    notes: string[];
    // mission-specific
    fileImpactPct?: number; // for missions that use file visualization (% files touched/scanned)
};

export type Plan = { before: string; after: string; highlights: string[] };

export type AnimationModel = {
    partitions: { id: number; size: number; spilled: boolean }[];
    files: { id: number; sizeMB: number; hot: boolean }[];
    meta: {
        mode: "shuffle" | "files";
        shuffleIntensity: number; // 0..1
        spillIntensity: number; // 0..1
        fileImpactPct?: number;
        fileCount?: number;
    };
};

export type Snapshot = {
    stages: StageMetric[];
    scorecard: Scorecard;
    plan: Plan;
    animation: AnimationModel;
};

export type CoachStep = {
    id: string;
    title: string;
    prompt: string;
    expectedKnobDiff: Partial<Knobs>;
    rationale: string;
    success: (snap: Snapshot, knobs: Knobs) => boolean;
};

export type Mission = {
    id: MissionId;
    title: string;
    subtitle: string;
    slaMinutes: number;
    baselineKnobs: Knobs;
    initialKnobs: Knobs;
    coachSteps: CoachStep[];
};
