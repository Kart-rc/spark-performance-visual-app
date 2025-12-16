import {
    AnimationModel,
    Knobs,
    MissionId,
    Plan,
    Scorecard,
    Snapshot,
    StageMetric,
} from "@/types";
import { missions } from "@/data/missions";

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}

function scaleStages(stages: StageMetric[], factor: number): StageMetric[] {
    return stages.map((s) => ({
        ...s,
        durationMs: Math.round(s.durationMs * factor),
        shuffleReadMB: Math.round(s.shuffleReadMB * factor),
        shuffleWriteMB: Math.round(s.shuffleWriteMB * factor),
        spillMB: Math.round(s.spillMB * factor),
        gcMs: Math.round(s.gcMs * factor),
    }));
}

export function baselineStages(missionId: MissionId): StageMetric[] {
    if (missionId === "etl_joins") {
        return [
            {
                id: "s1",
                name: "Scan + Parse",
                durationMs: 6_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 300,
                skewScore: 0.1,
            },
            {
                id: "s2",
                name: "Clean + Dedup",
                durationMs: 16_000,
                shuffleReadMB: 80,
                shuffleWriteMB: 90,
                spillMB: 20,
                gcMs: 800,
                skewScore: 0.2,
            },
            {
                id: "s3",
                name: "Join Orders ↔ Customers",
                durationMs: 62_000,
                shuffleReadMB: 260,
                shuffleWriteMB: 310,
                spillMB: 180,
                gcMs: 4_500,
                skewScore: 0.7,
            },
            {
                id: "s4",
                name: "Aggregate",
                durationMs: 28_000,
                shuffleReadMB: 140,
                shuffleWriteMB: 120,
                spillMB: 40,
                gcMs: 1_200,
                skewScore: 0.3,
            },
            {
                id: "s5",
                name: "Write Delta",
                durationMs: 14_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 500,
                skewScore: 0.1,
            },
        ];
    }

    if (missionId === "cdc_merge") {
        return [
            {
                id: "m1",
                name: "Scan CDC",
                durationMs: 7_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 250,
                skewScore: 0.1,
            },
            {
                id: "m2",
                name: "Dedup / Prep",
                durationMs: 28_000,
                shuffleReadMB: 220,
                shuffleWriteMB: 200,
                spillMB: 110,
                gcMs: 2_300,
                skewScore: 0.4,
            },
            {
                id: "m3",
                name: "MERGE Match (IO heavy)",
                durationMs: 78_000,
                shuffleReadMB: 120,
                shuffleWriteMB: 90,
                spillMB: 40,
                gcMs: 1_300,
                skewScore: 0.2,
            },
            {
                id: "m4",
                name: "Rewrite Files",
                durationMs: 52_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 800,
                skewScore: 0.1,
            },
        ];
    }

    if (missionId === "skew_tail") {
        return [
            {
                id: "k1",
                name: "Scan + Parse",
                durationMs: 7_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 350,
                skewScore: 0.15,
            },
            {
                id: "k2",
                name: "Join (hot key)",
                durationMs: 88_000,
                shuffleReadMB: 180,
                shuffleWriteMB: 190,
                spillMB: 90,
                gcMs: 2_800,
                skewScore: 0.92,
            },
            {
                id: "k3",
                name: "Aggregate (skew tail)",
                durationMs: 52_000,
                shuffleReadMB: 90,
                shuffleWriteMB: 85,
                spillMB: 70,
                gcMs: 2_100,
                skewScore: 0.88,
            },
            {
                id: "k4",
                name: "Write Delta",
                durationMs: 13_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 600,
                skewScore: 0.1,
            },
        ];
    }

    if (missionId === "cache_spill") {
        return [
            {
                id: "c1",
                name: "Scan + Parse",
                durationMs: 8_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 400,
                skewScore: 0.1,
            },
            {
                id: "c2",
                name: "Clean + Cache",
                durationMs: 22_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 150, // Baseline has spill due to cache pressure
                gcMs: 3_500,
                skewScore: 0.2,
            },
            {
                id: "c3",
                name: "Join (Reuse 1)",
                durationMs: 45_000,
                shuffleReadMB: 180,
                shuffleWriteMB: 160,
                spillMB: 80,
                gcMs: 1_200,
                skewScore: 0.3,
            },
            {
                id: "c4",
                name: "Agg (Reuse 2)",
                durationMs: 30_000,
                shuffleReadMB: 120,
                shuffleWriteMB: 100,
                spillMB: 40,
                gcMs: 800,
                skewScore: 0.2,
            },
        ];
    }

    if (missionId === "dpp_tuning") {
        return [
            {
                id: "d1",
                name: "Scan Fact (Partitioned)",
                durationMs: 65_000, // Slow full scan
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 500,
                skewScore: 0.1,
            },
            {
                id: "d2",
                name: "Scan Dim + Filter",
                durationMs: 5_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 100,
                skewScore: 0.1,
            },
            {
                id: "d3",
                name: "Broadcast Join",
                durationMs: 25_000,
                shuffleReadMB: 20,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 600,
                skewScore: 0.2,
            },
            {
                id: "d4",
                name: "Result Write",
                durationMs: 8_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 200,
                skewScore: 0.1,
            },
        ];
    }

    if (missionId === "udf_native") {
        return [
            {
                id: "u1",
                name: "Scan",
                durationMs: 5_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 100,
                skewScore: 0.1,
            },
            {
                id: "u2",
                name: "Agg (Python UDF)",
                durationMs: 45_000, // CPU bound
                shuffleReadMB: 50,
                shuffleWriteMB: 10,
                spillMB: 0,
                gcMs: 500,
                skewScore: 0.1,
            },
            {
                id: "u3",
                name: "Write",
                durationMs: 2_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 0,
                skewScore: 0,
            },
        ];
    }

    if (missionId === "wide_schema") {
        return [
            {
                id: "w1",
                name: "Scan (200 cols)",
                durationMs: 25_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 800, // Huge shuffle write due to wide rows
                spillMB: 0,
                gcMs: 2_000,
                skewScore: 0.1,
            },
            {
                id: "w2",
                name: "Exchange & Sort",
                durationMs: 30_000,
                shuffleReadMB: 800,
                shuffleWriteMB: 0,
                spillMB: 200,
                gcMs: 3_000,
                skewScore: 0.1,
            },
            {
                id: "w3",
                name: "Write",
                durationMs: 5_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 500,
                skewScore: 0,
            },
        ];
    }

    if (missionId === "multi_join") {
        return [
            {
                id: "m1",
                name: "Scan Tables",
                durationMs: 10_000,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 200,
                skewScore: 0.1,
            },
            {
                id: "m2",
                name: "Join A+B (Big)",
                durationMs: 50_000,
                shuffleReadMB: 600,
                shuffleWriteMB: 1200, // Explosion
                spillMB: 800,
                gcMs: 5_000,
                skewScore: 0.4,
            },
            {
                id: "m3",
                name: "Join +C +D +E",
                durationMs: 40_000,
                shuffleReadMB: 1200,
                shuffleWriteMB: 200,
                spillMB: 400,
                gcMs: 3_000,
                skewScore: 0.3,
            },
        ];
    }

    // small_files
    return [
        {
            id: "f1",
            name: "List + Open Files",
            durationMs: 38_000,
            shuffleReadMB: 0,
            shuffleWriteMB: 0,
            spillMB: 0,
            gcMs: 300,
            skewScore: 0.1,
        },
        {
            id: "f2",
            name: "Scan Delta (many small files)",
            durationMs: 74_000,
            shuffleReadMB: 0,
            shuffleWriteMB: 0,
            spillMB: 0,
            gcMs: 600,
            skewScore: 0.1,
        },
        {
            id: "f3",
            name: "Simple Transform",
            durationMs: 16_000,
            shuffleReadMB: 40,
            shuffleWriteMB: 35,
            spillMB: 10,
            gcMs: 450,
            skewScore: 0.2,
        },
        {
            id: "f4",
            name: "Write Delta",
            durationMs: 20_000,
            shuffleReadMB: 0,
            shuffleWriteMB: 0,
            spillMB: 0,
            gcMs: 500,
            skewScore: 0.1,
        },
    ];
}

export function baselinePlan(missionId: MissionId): Plan {
    if (missionId === "etl_joins") {
        const before = `== Physical Plan (Before) ==
*(3) SortMergeJoin [customer_id], [customer_id], Inner
:- *(1) Exchange hashpartitioning(customer_id, 200)
:  +- *(1) Scan Delta orders (wide)
+- *(2) Exchange hashpartitioning(customer_id, 200)
   +- *(2) Scan Delta customers
`;

        const after = `== Physical Plan (After) ==
*(2) BroadcastHashJoin [customer_id], [customer_id], Inner, BuildRight
:- *(1) Scan Delta orders (projected + filtered)
+- BroadcastExchange HashedRelationBroadcastMode
   +- *(1) Scan Delta customers (filtered)
AQE: coalesced shuffle partitions; skew handling where applicable
`;

        return {
            before,
            after,
            highlights: ["SortMergeJoin", "Exchange", "BroadcastHashJoin", "AQE"],
        };
    }

    if (missionId === "cdc_merge") {
        const before = `== Physical Plan (Before) ==
*(3) MergeIntoCommand
:- *(1) Scan Delta target (many files)
:  +- file pruning limited
+- *(2) Scan CDC (duplicates present)
`;

        const after = `== Physical Plan (After) ==
*(3) MergeIntoCommand
:- *(1) Scan Delta target (fewer files touched)
:  +- improved skipping via OPTIMIZE/ZORDER
+- *(2) CDC pre-dedup (latest per key)
Updates: only changed columns
`;

        return {
            before,
            after,
            highlights: ["MergeIntoCommand", "OPTIMIZE", "ZORDER", "pre-dedup"],
        };
    }

    if (missionId === "skew_tail") {
        const before = `== Physical Plan (Before) ==
*(3) SortMergeJoin [customer_id], [customer_id], Inner
:- *(1) Exchange hashpartitioning(customer_id, 200)
:  +- *(1) Scan Delta orders (skewed key)
+- *(2) Exchange hashpartitioning(customer_id, 200)
   +- *(2) Scan Delta customers
`;

        const after = `== Physical Plan (After) ==
*(2) (AQE) Join with skew handling where applicable
:- *(1) Scan Delta orders (projected + filtered)
+- *(1) Scan customers (maybe broadcast)
AQE: may split skewed partitions to reduce long-tail tasks
`;

        return {
            before,
            after,
            highlights: ["Skew", "AQE", "Long tail", "Broadcast"],
        };
    }

    if (missionId === "cache_spill") {
        const before = `== Physical Plan (Before) ==
*(2) InMemoryTableScan cached_data
:- *(1) Scan Delta source (wide)
*(3) Join (reuse 1)
*(4) Aggregate (reuse 2)
`;
        const after = `== Physical Plan (After) ==
*(2) InMemoryTableScan cached_data
:- *(1) Scan Delta source (projected + filtered)
*(3) Join (reuse 1)
*(4) Aggregate (reuse 2)
Cache: fits in memory, no spill
`;
        return {
            before,
            after,
            highlights: ["Cache", "InMemoryTableScan", "Spill", "GC"],
        };
    }

    if (missionId === "dpp_tuning") {
        const before = `== Physical Plan (Before) ==
*(2) BroadcastHashJoin [dim_id], [dim_id], Inner, BuildRight
:- *(1) Scan Delta fact (full scan)
+- BroadcastExchange HashedRelationBroadcastMode
   +- *(1) Scan Delta dim (filtered)
`;
        const after = `== Physical Plan (After) ==
*(2) BroadcastHashJoin [dim_id], [dim_id], Inner, BuildRight
:- *(1) Scan Delta fact (partition pruned)
+- BroadcastExchange HashedRelationBroadcastMode
   +- *(1) Scan Delta dim (filtered)
DPP: Dynamic Partition Pruning active
`;
        return {
            before,
            after,
            highlights: ["DPP", "Partition Pruning", "BroadcastHashJoin", "Scan"],
        };
    }

    if (missionId === "udf_native") {
        const before = `== Physical Plan (Before) ==
*(2) PythonUDF
:- *(1) Scan source
`;
        const after = `== Physical Plan (After) ==
*(2) Catalyst Expression (native)
:- *(1) Scan source
`;
        return {
            before,
            after,
            highlights: ["UDF", "Python", "Native", "Catalyst"],
        };
    }

    if (missionId === "wide_schema") {
        const before = `== Physical Plan (Before) ==
*(2) Exchange hashpartitioning(200 cols)
:- *(1) Scan source (200 cols)
`;
        const after = `== Physical Plan (After) ==
*(2) Exchange hashpartitioning(5 cols)
:- *(1) Scan source (5 cols, projected)
`;
        return {
            before,
            after,
            highlights: ["Wide Schema", "Column Pruning", "Shuffle", "Serialization"],
        };
    }

    if (missionId === "multi_join") {
        const before = `== Physical Plan (Before) ==
*(3) SortMergeJoin (A+B)
:- *(1) Exchange hashpartitioning(A.key)
:  +- *(1) Scan A
+- *(2) Exchange hashpartitioning(B.key)
   +- *(2) Scan B
*(4) SortMergeJoin ((A+B)+C)
`;
        const after = `== Physical Plan (After) ==
*(2) BroadcastHashJoin (A+C)
:- *(1) Scan A
+- BroadcastExchange HashedRelationBroadcastMode
   +- *(1) Scan C
*(3) SortMergeJoin ((A+C)+B)
`;
        return {
            before,
            after,
            highlights: ["Join Order", "Broadcast", "Shuffle", "Intermediate Data"],
        };
    }

    // small_files
    const before = `== Physical Plan (Before) ==
*(1) Scan Delta table (many small files)
:  +- high file open / listing overhead
*(2) Simple filter/project late
`;

    const after = `== Physical Plan (After) ==
*(1) Scan Delta table (compacted files)
:  +- OPTIMIZE reduces file count
:  +- ZORDER improves skipping for selective predicates
*(2) Filter/project earlier
`;

    return {
        before,
        after,
        highlights: ["Small files", "OPTIMIZE", "ZORDER", "Skipping"],
    };
}

function buildAnimation(
    missionId: MissionId,
    meta: {
        shuffleIntensity: number;
        spillIntensity: number;
        fileImpactPct?: number;
        fileCount?: number;
    }
): AnimationModel {
    if (missionId === "etl_joins" || missionId === "skew_tail") {
        // Partitions view
        const partitions = Array.from({ length: 18 }).map((_, i) => {
            const hot = missionId === "skew_tail";
            const base = hot && i === 5 ? 18 : i === 5 ? 12 : 4;
            const size =
                base +
                Math.round(meta.shuffleIntensity * (i === 5 ? (hot ? 28 : 20) : 8));
            const spilled = meta.spillIntensity > 0.45 && (i === 5 || i % 7 === 0);
            return { id: i, size, spilled };
        });
        return {
            partitions,
            files: [],
            meta: {
                mode: "shuffle",
                shuffleIntensity: meta.shuffleIntensity,
                spillIntensity: meta.spillIntensity,
            },
        };
    }

    // Files view (MERGE + small files)
    const count = meta.fileCount ?? (missionId === "small_files" ? 54 : 30);
    const impact = clamp(meta.fileImpactPct ?? 60, 0, 100);
    const hotCount = Math.max(1, Math.round((impact / 100) * count));

    const files = Array.from({ length: count }).map((_, i) => {
        const small = missionId === "small_files";
        const sizeMB = small ? 4 + (i % 5) * 2 : 16 + (i % 6) * 4;
        return { id: i, sizeMB, hot: i < hotCount };
    });

    return {
        partitions: [],
        files,
        meta: {
            mode: "files",
            shuffleIntensity: meta.shuffleIntensity,
            spillIntensity: meta.spillIntensity,
            fileImpactPct: impact,
            fileCount: count,
        },
    };
}

function computeScorecard(
    missionId: MissionId,
    stages: StageMetric[],
    meta: { fileImpactPct?: number; notes: string[] }
): Scorecard {
    const totalMs = stages.reduce((a, s) => a + s.durationMs, 0);
    const runtimeMin = Math.max(1, Math.round(totalMs / 60000));
    const shuffle = stages.reduce(
        (a, s) => a + s.shuffleReadMB + s.shuffleWriteMB,
        0
    );
    const spill = stages.reduce((a, s) => a + s.spillMB, 0);
    const costUnits = Math.round(
        (totalMs / 1000) * 0.02 + shuffle * 0.03 + spill * 0.05
    );

    const sla = missions[missionId].slaMinutes;
    const slaRisk: Scorecard["slaRisk"] =
        runtimeMin <= sla ? "low" : runtimeMin <= sla * 1.2 ? "medium" : "high";

    const notes: string[] = [];
    if (shuffle > 500)
        notes.push(
            "High shuffle volume → look for wide transformations or join strategy changes."
        );
    if (spill > 200)
        notes.push(
            "Spill detected → reduce shuffle payload, watch caching/memory pressure, enable AQE."
        );
    const skewWorst = stages.reduce((m, s) => Math.max(m, s.skewScore), 0);
    if (skewWorst > 0.75)
        notes.push(
            "Severe skew → long-tail tasks. Consider AQE skew handling and reducing payload before the hotspot."
        );

    if (typeof meta.fileImpactPct === "number") {
        if (meta.fileImpactPct > 60)
            notes.push(
                "File overhead dominates → too many small files or poor skipping. Use OPTIMIZE/ZORDER and pushdown-friendly predicates."
            );
        if (meta.fileImpactPct <= 30)
            notes.push("Nice: fewer hot files → faster, cheaper reads/merges.");
    }

    return {
        runtimeMin,
        costUnits,
        slaRisk,
        notes: [...meta.notes, ...notes].slice(0, 7),
        fileImpactPct: meta.fileImpactPct,
    };
}

export function simulate(missionId: MissionId, knobs: Knobs): Snapshot {
    let stages = baselineStages(missionId);
    let plan = baselinePlan(missionId);

    // Meta for visuals
    let shuffleIntensity =
        missionId === "etl_joins"
            ? 0.85
            : missionId === "skew_tail"
                ? 0.72
                : missionId === "cache_spill"
                    ? 0.6
                    : missionId === "multi_join"
                        ? 0.9
                        : missionId === "wide_schema"
                            ? 0.8
                            : 0.35;
    let spillIntensity =
        missionId === "etl_joins"
            ? 0.75
            : missionId === "skew_tail"
                ? 0.62
                : missionId === "cache_spill"
                    ? 0.8
                    : missionId === "multi_join"
                        ? 0.95
                        : 0.2;
    let fileImpactPct: number | undefined =
        missionId === "cdc_merge"
            ? 65
            : missionId === "small_files"
                ? 82
                : missionId === "dpp_tuning"
                    ? 90
                    : undefined;

    const notes: string[] = [];

    // Shared patterns
    if (knobs.projectEarly) {
        stages = scaleStages(stages, 0.9);
        shuffleIntensity *= 0.84;
        spillIntensity *= 0.9;
        if (typeof fileImpactPct === "number") fileImpactPct -= 6;
        notes.push("Projection early reduces bytes scanned + shuffled.");
    }
    if (knobs.filterEarly) {
        stages = scaleStages(stages, 0.86);
        shuffleIntensity *= 0.8;
        spillIntensity *= 0.86;
        if (typeof fileImpactPct === "number") fileImpactPct -= 8;
        notes.push("Filter early shrinks the dataset before hotspots.");
    }

    if (knobs.aqe) {
        stages = stages.map((s) => ({
            ...s,
            durationMs: Math.round(s.durationMs * 0.92),
            skewScore: clamp(s.skewScore * 0.78, 0, 1),
            spillMB: Math.round(s.spillMB * 0.85),
        }));
        shuffleIntensity *= 0.9;
        spillIntensity *= 0.82;
        notes.push(
            "AQE coalesces partitions and can mitigate skew (where supported). "
        );
    }

    // Mission-specific logic
    if (missionId === "etl_joins") {
        const thresholdOk = knobs.broadcastThresholdMB >= 10;
        if (knobs.broadcastCustomers && thresholdOk) {
            stages = stages.map((s) =>
                s.id === "s3"
                    ? {
                        ...s,
                        durationMs: Math.round(s.durationMs * 0.55),
                        shuffleReadMB: Math.round(s.shuffleReadMB * 0.35),
                        shuffleWriteMB: Math.round(s.shuffleWriteMB * 0.25),
                        spillMB: Math.round(s.spillMB * 0.25),
                        gcMs: Math.round(s.gcMs * 0.6),
                        skewScore: clamp(s.skewScore * 0.75, 0, 1),
                    }
                    : s
            );
            shuffleIntensity *= 0.55;
            spillIntensity *= 0.6;
            notes.push("BroadcastHashJoin avoids shuffling the large side.");
        } else if (knobs.broadcastCustomers && !thresholdOk) {
            stages = stages.map((s) =>
                s.id === "s3"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.95) }
                    : s
            );
            notes.push(
                "Broadcast requested but threshold too low → Spark likely won’t broadcast."
            );
        }

        if (knobs.cacheAfterClean) {
            const heavyShuffle =
                stages.reduce((a, s) => a + s.shuffleReadMB + s.shuffleWriteMB, 0) >
                450;
            if (heavyShuffle) {
                stages = stages.map((s) => ({
                    ...s,
                    spillMB: Math.round(s.spillMB * 1.25 + (s.id === "s3" ? 40 : 0)),
                    gcMs: Math.round(s.gcMs * 1.18),
                    durationMs: Math.round(s.durationMs * 1.08),
                }));
                spillIntensity *= 1.2;
                notes.push(
                    "Caching increased memory pressure → more GC + spill. Cache selectively."
                );
            } else {
                stages = stages.map((s) => ({
                    ...s,
                    durationMs: Math.round(s.durationMs * 0.92),
                }));
                notes.push(
                    "Caching helped because the cleaned dataset was reused and memory pressure stayed manageable."
                );
            }
        }

        const joinIsBroadcast =
            knobs.broadcastCustomers && knobs.broadcastThresholdMB >= 10;
        plan = {
            before: plan.before,
            after: joinIsBroadcast
                ? plan.after
                : plan.after.replace("BroadcastHashJoin", "SortMergeJoin"),
            highlights: plan.highlights,
        };
    }

    if (missionId === "skew_tail") {
        const thresholdOk = knobs.broadcastThresholdMB >= 10;

        if (knobs.broadcastCustomers && thresholdOk) {
            stages = stages.map((s) =>
                s.id === "k2"
                    ? {
                        ...s,
                        durationMs: Math.round(s.durationMs * 0.88),
                        shuffleReadMB: Math.round(s.shuffleReadMB * 0.6),
                        shuffleWriteMB: Math.round(s.shuffleWriteMB * 0.55),
                        spillMB: Math.round(s.spillMB * 0.8),
                    }
                    : s
            );
            shuffleIntensity *= 0.78;
            spillIntensity *= 0.9;
            notes.push("Broadcast removed a shuffle boundary, reducing some overhead.");
        } else if (knobs.broadcastCustomers && !thresholdOk) {
            notes.push(
                "Broadcast requested but threshold too low → likely no broadcast."
            );
        }

        if (knobs.aqe) {
            stages = stages.map((s) =>
                s.id === "k2" || s.id === "k3"
                    ? {
                        ...s,
                        skewScore: clamp(s.skewScore * 0.7, 0, 1),
                        durationMs: Math.round(s.durationMs * 0.86),
                        spillMB: Math.round(s.spillMB * 0.75),
                    }
                    : s
            );
            shuffleIntensity *= 0.9;
            spillIntensity *= 0.82;
            plan = {
                before: baselinePlan("skew_tail").before,
                after:
                    baselinePlan("skew_tail").after +
                    (knobs.broadcastCustomers && thresholdOk
                        ? "Join: BroadcastHashJoin chosen\n"
                        : "Join: still shuffle-based\n"),
                highlights: baselinePlan("skew_tail").highlights,
            };
        } else {
            plan = {
                before: baselinePlan("skew_tail").before,
                after:
                    baselinePlan("skew_tail").after +
                    "AQE disabled → long-tail tasks likely persist\n",
                highlights: baselinePlan("skew_tail").highlights,
            };
        }

        if (knobs.cacheAfterClean) {
            stages = stages.map((s) => ({
                ...s,
                gcMs: Math.round(s.gcMs * 1.2),
                durationMs: Math.round(s.durationMs * 1.06),
            }));
            spillIntensity *= 1.12;
            notes.push(
                "Caching widened memory pressure in the hot partition → more GC. Not always helpful for skew."
            );
        }
    }

    if (missionId === "cdc_merge") {
        let tf = fileImpactPct ?? 65;

        if (knobs.preDedupCdc) {
            stages = stages.map((s) =>
                s.id === "m2"
                    ? {
                        ...s,
                        durationMs: Math.round(s.durationMs * 0.65),
                        shuffleReadMB: Math.round(s.shuffleReadMB * 0.6),
                        shuffleWriteMB: Math.round(s.shuffleWriteMB * 0.6),
                        spillMB: Math.round(s.spillMB * 0.6),
                        gcMs: Math.round(s.gcMs * 0.7),
                    }
                    : s
            );
            shuffleIntensity *= 0.78;
            spillIntensity *= 0.82;
            tf -= 8;
            notes.push(
                "Pre-dedup CDC reduces shuffle and avoids repeated updates per key."
            );
        }

        if (knobs.updateOnlyChangedCols) {
            stages = stages.map((s) =>
                s.id === "m4"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.82) }
                    : s
            );
            tf -= 4;
            notes.push("Updating only changed columns reduces rewrite work.");
        }

        if (knobs.optimizeBeforeMerge) {
            stages = stages.map((s) =>
                s.id === "m3"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.78) }
                    : s
            );
            tf -= 18;
            notes.push(
                "OPTIMIZE reduces small files → fewer file opens + better pruning behavior."
            );
        }

        if (knobs.zOrderOnKeys) {
            stages = stages.map((s) =>
                s.id === "m3"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.85) }
                    : s
            );
            tf -= 12;
            notes.push(
                "ZORDER improves locality → fewer files scanned/touched for key-based lookups."
            );
        }

        if (knobs.dynamicPruning) {
            stages = stages.map((s) =>
                s.id === "m3"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.93) }
                    : s
            );
            tf -= 3;
            notes.push(
                "Dynamic pruning can reduce scanned data when join filters align with partitions."
            );
        }

        fileImpactPct = clamp(tf, 5, 95);

        const afterLines: string[] = [];
        afterLines.push("== Physical Plan (After) ==");
        afterLines.push("*(3) MergeIntoCommand");
        afterLines.push(`:- *(1) Scan Delta target (${fileImpactPct}% files touched)`);
        afterLines.push(
            knobs.optimizeBeforeMerge || knobs.zOrderOnKeys
                ? ":  +- improved skipping via OPTIMIZE/ZORDER"
                : ":  +- limited skipping (many small files)"
        );
        afterLines.push(
            knobs.preDedupCdc
                ? "+- *(2) CDC pre-dedup (latest per key)"
                : "+- *(2) Scan CDC (duplicates present)"
        );
        afterLines.push(
            knobs.updateOnlyChangedCols
                ? "Updates: only changed columns"
                : "Updates: wide update (rewrite amplification)"
        );

        plan = {
            before: baselinePlan("cdc_merge").before,
            after: afterLines.join("\n") + "\n",
            highlights: baselinePlan("cdc_merge").highlights,
        };
    }

    if (missionId === "small_files") {
        let tf = fileImpactPct ?? 82;



        if (knobs.optimizeBeforeMerge) {
            stages = stages.map((s) =>
                s.id === "f1" || s.id === "f2"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.68) }
                    : s
            );
            tf -= 28;
            notes.push("OPTIMIZE compacts small files → fewer opens + faster scans.");
        }

        if (knobs.zOrderOnKeys) {
            stages = stages.map((s) =>
                s.id === "f2"
                    ? { ...s, durationMs: Math.round(s.durationMs * 0.82) }
                    : s
            );
            tf -= 16;
            notes.push("ZORDER improves skipping for selective predicates.");
        }

        if (knobs.cacheAfterClean) {
            stages = stages.map((s) => ({
                ...s,
                durationMs: Math.round(s.durationMs * 1.03),
                gcMs: Math.round(s.gcMs * 1.18),
            }));
            notes.push(
                "Caching doesn't fix file-open overhead; it can add memory/GC cost."
            );
        }

        fileImpactPct = clamp(tf, 10, 95);

        plan = {
            before: baselinePlan("small_files").before,
            after:
                baselinePlan("small_files").after +
                `File impact: ${fileImpactPct}% of files scanned ` +
                (knobs.optimizeBeforeMerge ? "(compacted)" : "(uncompacted)") +
                "\n",
            highlights: baselinePlan("small_files").highlights,
        };
    }

    if (missionId === "cache_spill") {
        // Baseline: Cache is ON, but dataset is huge -> Spill
        // Fix: Project/Filter early -> Cache fits in memory

        let memoryPressure = 1.0;

        if (knobs.projectEarly) memoryPressure -= 0.3;
        if (knobs.filterEarly) memoryPressure -= 0.4;

        if (knobs.cacheAfterClean) {
            if (memoryPressure > 0.5) {
                // Bad cache
                stages = stages.map((s) =>
                    s.id === "c2"
                        ? {
                            ...s,
                            spillMB: 300,
                            gcMs: 5000,
                            durationMs: Math.round(s.durationMs * 1.5),
                        }
                        : s
                );
                spillIntensity = 0.95;
                notes.push(
                    "Cache overflow! Dataset too big for memory → heavy spill + GC."
                );
            } else {
                // Good cache
                stages = stages.map((s) =>
                    s.id === "c2"
                        ? {
                            ...s,
                            spillMB: 0,
                            gcMs: 600,
                            durationMs: Math.round(s.durationMs * 0.4),
                        }
                        : s.id === "c3" || s.id === "c4"
                            ? { ...s, durationMs: Math.round(s.durationMs * 0.7) } // Downstream benefits
                            : s
                );
                spillIntensity = 0.1;
                notes.push("Cache fits in memory! Downstream stages read fast.");
            }
        } else {
            // No cache
            stages = stages.map((s) =>
                s.id === "c2"
                    ? {
                        ...s,
                        spillMB: 0,
                        gcMs: 400,
                        durationMs: Math.round(s.durationMs * 0.2), // Fast pass-through
                    }
                    : s.id === "c3" || s.id === "c4"
                        ? { ...s, durationMs: Math.round(s.durationMs * 1.2) } // Recompute penalty
                        : s
            );
            spillIntensity = 0.2;
            notes.push(
                "Cache disabled. No spill, but downstream stages recompute/reread data."
            );
        }

        plan = {
            before: baselinePlan("cache_spill").before,
            after:
                memoryPressure <= 0.5 && knobs.cacheAfterClean
                    ? baselinePlan("cache_spill").after
                    : baselinePlan("cache_spill").before,
            highlights: baselinePlan("cache_spill").highlights,
        };
    }

    if (missionId === "dpp_tuning") {
        let scanFactor = 1.0;
        let dppActive = false;

        if (knobs.dynamicPruning && knobs.filterEarly) {
            dppActive = true;
            scanFactor = 0.15; // Huge win
            notes.push(
                "DPP Active! Fact table scan pruned based on dimension filter."
            );
        } else if (knobs.dynamicPruning && !knobs.filterEarly) {
            scanFactor = 0.95; // Minimal overhead
            notes.push(
                "DPP enabled but dimension filter is weak/missing → little pruning."
            );
        } else {
            notes.push("DPP disabled. Full scan of fact table.");
        }

        stages = stages.map((s) =>
            s.id === "d1"
                ? {
                    ...s,
                    durationMs: Math.round(s.durationMs * scanFactor),
                }
                : s
        );

        if (dppActive) {
            fileImpactPct = 15;
            plan = {
                before: baselinePlan("dpp_tuning").before,
                after: baselinePlan("dpp_tuning").after,
                highlights: baselinePlan("dpp_tuning").highlights,
            };
        } else {
            fileImpactPct = 90;
            plan = {
                before: baselinePlan("dpp_tuning").before,
                after: baselinePlan("dpp_tuning").before, // No change
                highlights: baselinePlan("dpp_tuning").highlights,
            };
        }
    }

    if (missionId === "udf_native") {
        // Baseline: Python UDF (Slow CPU)
        // Fix: Native (Fast CPU)
        if (knobs.useUdf) {
            notes.push("Python UDF enabled. Serialization overhead is high.");
            plan = {
                before: baselinePlan("udf_native").before,
                after: baselinePlan("udf_native").before,
                highlights: baselinePlan("udf_native").highlights,
            };
        } else {
            notes.push("Native functions enabled. Catalyst codegen active.");
            stages = stages.map((s) =>
                s.id === "u2"
                    ? {
                        ...s,
                        durationMs: 2000, // Massive speedup
                        name: "Agg (Native)",
                    }
                    : s
            );
            plan = {
                before: baselinePlan("udf_native").before,
                after: baselinePlan("udf_native").after,
                highlights: baselinePlan("udf_native").highlights,
            };
        }
    }

    if (missionId === "wide_schema") {
        // Baseline: Select * (Wide)
        // Fix: Project Early (Narrow)
        if (knobs.projectEarly) {
            notes.push("Column pruning active. Only reading/shuffling required data.");
            stages = stages.map((s) => ({
                ...s,
                shuffleWriteMB: Math.round(s.shuffleWriteMB * 0.1),
                shuffleReadMB: Math.round(s.shuffleReadMB * 0.1),
                spillMB: 0,
                gcMs: Math.round(s.gcMs * 0.2),
                durationMs: Math.round(s.durationMs * 0.3),
            }));
            shuffleIntensity = 0.2;
            plan = {
                before: baselinePlan("wide_schema").before,
                after: baselinePlan("wide_schema").after,
                highlights: baselinePlan("wide_schema").highlights,
            };
        } else {
            notes.push("Wide schema scan. Serialization costs are high.");
            plan = {
                before: baselinePlan("wide_schema").before,
                after: baselinePlan("wide_schema").before,
                highlights: baselinePlan("wide_schema").highlights,
            };
        }
    }

    if (missionId === "multi_join") {
        // Baseline: Bad order (Big+Big)
        // Fix: Optimize Order + Broadcast
        let improvement = 1.0;
        if (knobs.optimizeJoinOrder) improvement -= 0.6;
        if (knobs.broadcastCustomers) improvement -= 0.2; // "Customers" here represents small tables

        if (improvement < 0.5) {
            notes.push("Join order optimized. Intermediate explosion avoided.");
            stages = stages.map((s) => ({
                ...s,
                spillMB: 0,
                shuffleWriteMB: Math.round(s.shuffleWriteMB * 0.2),
                durationMs: Math.round(s.durationMs * 0.25),
                gcMs: Math.round(s.gcMs * 0.3),
            }));
            shuffleIntensity = 0.4;
            spillIntensity = 0.1;
            plan = {
                before: baselinePlan("multi_join").before,
                after: baselinePlan("multi_join").after,
                highlights: baselinePlan("multi_join").highlights,
            };
        } else {
            notes.push("Inefficient join order. Intermediate data explosion.");
            plan = {
                before: baselinePlan("multi_join").before,
                after: baselinePlan("multi_join").before,
                highlights: baselinePlan("multi_join").highlights,
            };
        }
    }

    const animation = buildAnimation(missionId, {
        shuffleIntensity: clamp(shuffleIntensity, 0, 1),
        spillIntensity: clamp(spillIntensity, 0, 1),
        fileImpactPct,
        fileCount:
            missionId === "small_files"
                ? 54
                : missionId === "cdc_merge"
                    ? 30
                    : missionId === "dpp_tuning"
                        ? 40
                        : undefined,
    });

    const scorecard = computeScorecard(missionId, stages, {
        fileImpactPct,
        notes,
    });

    return { stages, scorecard, plan, animation };
}

export function diffLines(before: string, after: string) {
    const b = before.split("\n");
    const a = after.split("\n");
    const setB = new Set(b);
    const setA = new Set(a);
    const out: { kind: "same" | "add" | "del"; text: string }[] = [];

    for (const line of b) {
        if (!setA.has(line) && line.trim() !== "")
            out.push({ kind: "del", text: line });
        else out.push({ kind: "same", text: line });
    }
    out.push({ kind: "same", text: "" });
    for (const line of a) {
        if (!setB.has(line) && line.trim() !== "")
            out.push({ kind: "add", text: line });
    }
    return out;
}
