import { Knobs, Mission, MissionId } from "@/types";

export const defaultKnobs: Knobs = {
    aqe: false,
    dynamicPruning: false,
    broadcastCustomers: false,
    broadcastThresholdMB: 10,
    cacheAfterClean: false,
    optimizeBeforeMerge: false,
    zOrderOnKeys: false,
    preDedupCdc: false,
    updateOnlyChangedCols: false,
    projectEarly: false,
    filterEarly: false,
    useUdf: true, // Bad default for Mission 7
    optimizeJoinOrder: false, // Bad default for Mission 9
};

function mergeKnobs(base: Knobs, patch: Partial<Knobs>): Knobs {
    return { ...base, ...patch };
}

export const missions: Record<MissionId, Mission> = {
    etl_joins: {
        id: "etl_joins",
        title: "Mission 1 — Joins-heavy ETL slowdown",
        subtitle:
            "Late filter + no projection + no broadcast → big shuffle, spill, and long stage tail.",
        slaMinutes: 30,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            dynamicPruning: false,
            broadcastCustomers: false,
            broadcastThresholdMB: 10,
            cacheAfterClean: false,
            projectEarly: false,
            filterEarly: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            dynamicPruning: false,
            broadcastCustomers: false,
            broadcastThresholdMB: 10,
            cacheAfterClean: false,
            projectEarly: false,
            filterEarly: false,
        }),
        coachSteps: [
            {
                id: "etl_s1",
                title: "Read the instruments",
                prompt:
                    "Identify the bottleneck: which stage has the biggest shuffle + spill?",
                expectedKnobDiff: {},
                rationale:
                    "Spark tuning starts with reading the stage breakdown. Shuffle + spill usually means a wide transformation or expensive join strategy.",
                success: (snap) => {
                    const worst = snap.stages.reduce((a, b) =>
                        a.shuffleReadMB + a.shuffleWriteMB + a.spillMB >
                            b.shuffleReadMB + b.shuffleWriteMB + b.spillMB
                            ? a
                            : b
                    );
                    return worst.shuffleReadMB + worst.shuffleWriteMB > 200;
                },
            },
            {
                id: "etl_s2",
                title: "Project early",
                prompt: "Turn on **Project Early** to reduce IO and shuffle payload.",
                expectedKnobDiff: { projectEarly: true },
                rationale:
                    "Selecting only necessary columns early reduces bytes moved across the network and lowers memory pressure.",
                success: (_snap, knobs) => knobs.projectEarly,
            },
            {
                id: "etl_s3",
                title: "Filter early",
                prompt: "Turn on **Filter Early** to shrink data before the join.",
                expectedKnobDiff: { filterEarly: true },
                rationale:
                    "Filtering before the join can cut shuffle volume dramatically. It also improves the chance of broadcast joins being viable.",
                success: (_snap, knobs) => knobs.filterEarly,
            },
            {
                id: "etl_s4",
                title: "Broadcast the dimension",
                prompt:
                    "Enable **Broadcast Customers** (and adjust threshold if needed).",
                expectedKnobDiff: { broadcastCustomers: true },
                rationale:
                    "BroadcastHashJoin avoids shuffling the big side when one table is small enough. It’s often the biggest single win for joins-heavy ETL.",
                success: (snap, knobs) =>
                    knobs.broadcastCustomers &&
                    snap.plan.after.toLowerCase().includes("broadcasthashjoin"),
            },
            {
                id: "etl_s5",
                title: "Turn on AQE",
                prompt:
                    "Enable **AQE** to coalesce shuffle partitions and mitigate skew.",
                expectedKnobDiff: { aqe: true },
                rationale:
                    "Adaptive Query Execution can reduce tiny tasks, coalesce partitions, and apply skew join handling when enabled.",
                success: (_snap, knobs) => knobs.aqe,
            },
            {
                id: "etl_s6",
                title: "Cache carefully",
                prompt:
                    "Try **Cache After Clean**. Observe: does runtime improve or do spill/GC get worse?",
                expectedKnobDiff: { cacheAfterClean: true },
                rationale:
                    "Caching helps when reused and when memory is sufficient. Otherwise it can increase GC and spill.",
                success: (_snap, knobs) => knobs.cacheAfterClean,
            },
        ],
    },

    cdc_merge: {
        id: "cdc_merge",
        title: "Mission 2 — CDC MERGE into Delta is slow",
        subtitle:
            "CDC has duplicates + MERGE touches too many files. Teach pre-dedup, update-only-changed, OPTIMIZE/ZORDER effects.",
        slaMinutes: 45,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            optimizeBeforeMerge: false,
            zOrderOnKeys: false,
            preDedupCdc: false,
            updateOnlyChangedCols: false,
            aqe: false,
            dynamicPruning: false,
            projectEarly: false,
            filterEarly: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            optimizeBeforeMerge: false,
            zOrderOnKeys: false,
            preDedupCdc: false,
            updateOnlyChangedCols: false,
            aqe: true,
            dynamicPruning: true,
            projectEarly: true,
            filterEarly: true,
        }),
        coachSteps: [
            {
                id: "m_s1",
                title: "See the blast radius",
                prompt:
                    "Focus on **files touched**. If MERGE lights up too many files, you’ll be IO-bound.",
                expectedKnobDiff: {},
                rationale:
                    "Delta MERGE cost is dominated by how many files must be read/rewritten.",
                success: (snap) => (snap.scorecard.fileImpactPct ?? 100) > 40,
            },
            {
                id: "m_s2",
                title: "Pre-dedup CDC",
                prompt:
                    "Enable **Pre-dedup CDC** to keep only the latest change per key.",
                expectedKnobDiff: { preDedupCdc: true },
                rationale:
                    "Duplicates inflate shuffle during MERGE and can cause repeated updates to the same key.",
                success: (_snap, knobs) => knobs.preDedupCdc,
            },
            {
                id: "m_s3",
                title: "Update only changed columns",
                prompt: "Enable **Update Only Changed Cols** to avoid wide updates.",
                expectedKnobDiff: { updateOnlyChangedCols: true },
                rationale:
                    "Writing fewer columns reduces rewrite work and compaction pressure.",
                success: (_snap, knobs) => knobs.updateOnlyChangedCols,
            },
            {
                id: "m_s4",
                title: "OPTIMIZE before MERGE",
                prompt: "Enable **OPTIMIZE Before Merge** to reduce small files.",
                expectedKnobDiff: { optimizeBeforeMerge: true },
                rationale:
                    "Too many small files increases file open overhead and broadens the set of files MERGE might touch.",
                success: (_snap, knobs) => knobs.optimizeBeforeMerge,
            },
            {
                id: "m_s5",
                title: "ZORDER on keys",
                prompt:
                    "Enable **ZORDER on keys** to improve data skipping for MERGE lookups.",
                expectedKnobDiff: { zOrderOnKeys: true },
                rationale:
                    "Clustering related keys can reduce the number of files scanned/touched.",
                success: (_snap, knobs) => knobs.zOrderOnKeys,
            },
            {
                id: "m_s6",
                title: "Validate success",
                prompt:
                    "Goal: files touched goes down and runtime drops while maintaining correctness.",
                expectedKnobDiff: {},
                rationale:
                    "You should now see fewer files light up and a smaller IO-heavy stage.",
                success: (snap) => (snap.scorecard.fileImpactPct ?? 100) <= 25,
            },
        ],
    },

    skew_tail: {
        id: "skew_tail",
        title: "Mission 3 — Skew & long-tail tasks",
        subtitle:
            "One hot key creates a straggler task. The job 'almost finishes' then stalls.",
        slaMinutes: 35,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            broadcastCustomers: false,
            broadcastThresholdMB: 10,
            projectEarly: false,
            filterEarly: false,
            cacheAfterClean: false,
            dynamicPruning: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            broadcastCustomers: false,
            broadcastThresholdMB: 10,
            projectEarly: true,
            filterEarly: true,
            cacheAfterClean: false,
            dynamicPruning: false,
        }),
        coachSteps: [
            {
                id: "sk_s1",
                title: "Spot the long tail",
                prompt:
                    "Look for high **Skew%** and a stage with long duration even when shuffle isn't extreme.",
                expectedKnobDiff: {},
                rationale:
                    "Skew is about uneven work distribution. A single partition can dominate runtime.",
                success: (snap) => snap.stages.some((s) => s.skewScore > 0.75),
            },
            {
                id: "sk_s2",
                title: "Reduce payload",
                prompt: "Turn on **Project Early** to shrink per-row payload.",
                expectedKnobDiff: { projectEarly: true },
                rationale:
                    "Skewed partitions hurt more when each row is wide. Column pruning reduces memory and IO pressure.",
                success: (_snap, knobs) => knobs.projectEarly,
            },
            {
                id: "sk_s3",
                title: "Filter before the hotspot",
                prompt:
                    "Turn on **Filter Early** so fewer rows hit the skewed join/agg.",
                expectedKnobDiff: { filterEarly: true },
                rationale:
                    "Filtering earlier reduces the amount of data in the hot partition.",
                success: (_snap, knobs) => knobs.filterEarly,
            },
            {
                id: "sk_s4",
                title: "Enable AQE",
                prompt:
                    "Enable **AQE**. Observe if skew% and runtime improve (simulating skew join handling).",
                expectedKnobDiff: { aqe: true },
                rationale:
                    "With AQE, Spark can apply skew handling and coalesce partitions (depending on version and query shape).",
                success: (_snap, knobs) => knobs.aqe,
            },
            {
                id: "sk_s5",
                title: "Try broadcast",
                prompt:
                    "Enable **Broadcast Customers**. Does it reduce the skew pain by removing a shuffle boundary?",
                expectedKnobDiff: { broadcastCustomers: true },
                rationale:
                    "Broadcast can remove some shuffles, but it doesn't always fix skew if the skew is in aggregation or downstream.",
                success: (_snap, knobs) => knobs.broadcastCustomers,
            },
            {
                id: "sk_s6",
                title: "Validate: tail reduced",
                prompt:
                    "Goal: skew% drops and runtime improves without relying on repartition.",
                expectedKnobDiff: {},
                rationale:
                    "You should see the oversized partition shrink and fewer 'spill' flags.",
                success: (snap) =>
                    snap.stages.reduce((m, s) => Math.max(m, s.skewScore), 0) <= 0.55,
            },
        ],
    },

    small_files: {
        id: "small_files",
        title: "Mission 4 — Small files & write amplification",
        subtitle:
            "Many tiny Delta files make reads slow and inflate downstream MERGE/compaction costs.",
        slaMinutes: 40,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            optimizeBeforeMerge: false,
            zOrderOnKeys: false,
            projectEarly: false,
            filterEarly: false,
            cacheAfterClean: false,
            aqe: true,
            dynamicPruning: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            optimizeBeforeMerge: false,
            zOrderOnKeys: false,
            projectEarly: true,
            filterEarly: true,
            cacheAfterClean: false,
            aqe: true,
            dynamicPruning: false,
        }),
        coachSteps: [
            {
                id: "sf_s1",
                title: "Diagnose: IO dominated",
                prompt:
                    "Notice runtime is high even though logic is simple. File-impact% is high → too many small files.",
                expectedKnobDiff: {},
                rationale:
                    "Small files increase listing + open costs and can broaden scans, making jobs IO-bound.",
                success: (snap) => (snap.scorecard.fileImpactPct ?? 100) > 60,
            },
            {
                id: "sf_s2",
                title: "Project early",
                prompt:
                    "Turn on **Project Early** (column pruning) to reduce bytes read (helps but won't fix file overhead).",
                expectedKnobDiff: { projectEarly: true },
                rationale:
                    "Projection reduces read bytes, but file-open overhead still remains if you have too many files.",
                success: (_snap, knobs) => knobs.projectEarly,
            },
            {
                id: "sf_s3",
                title: "Filter early",
                prompt:
                    "Turn on **Filter Early** to reduce scan range (helps if filters align with partitions).",
                expectedKnobDiff: { filterEarly: true },
                rationale:
                    "Filtering can reduce scanned data, but many small files still impose overhead.",
                success: (_snap, knobs) => knobs.filterEarly,
            },
            {
                id: "sf_s4",
                title: "OPTIMIZE",
                prompt:
                    "Enable **OPTIMIZE** to compact small files. Watch file-impact% drop.",
                expectedKnobDiff: { optimizeBeforeMerge: true },
                rationale: "Compaction reduces file count and improves scan efficiency.",
                success: (_snap, knobs) => knobs.optimizeBeforeMerge,
            },
            {
                id: "sf_s5",
                title: "ZORDER",
                prompt:
                    "Enable **ZORDER on keys**. This should reduce file-impact% further for selective queries.",
                expectedKnobDiff: { zOrderOnKeys: true },
                rationale:
                    "Clustering improves skipping so fewer files are scanned for key predicates.",
                success: (_snap, knobs) => knobs.zOrderOnKeys,
            },
            {
                id: "sf_s6",
                title: "Validate: file overhead reduced",
                prompt: "Goal: file-impact% <= 30 and runtime drops.",
                expectedKnobDiff: {},
                rationale: "The file grid should show far fewer hot files.",
                success: (snap) => (snap.scorecard.fileImpactPct ?? 100) <= 30,
            },
        ],
    },

    cache_spill: {
        id: "cache_spill",
        title: "Mission 5 — Cache Helped… Until It Didn’t",
        subtitle:
            "Pipeline with reused intermediate. Cache improves runtime at first, then data grows → memory pressure → spill + GC.",
        slaMinutes: 35,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            cacheAfterClean: true, // The trap!
            projectEarly: false,
            filterEarly: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            aqe: false,
            cacheAfterClean: true,
            projectEarly: false,
            filterEarly: false,
        }),
        coachSteps: [
            {
                id: "cs_s1",
                title: "Diagnose the regression",
                prompt:
                    "Look at the stage metrics. High GC and Spill suggest memory pressure.",
                expectedKnobDiff: {},
                rationale:
                    "Caching is not free. If the dataset grows beyond available memory, caching causes spill to disk and heavy GC, often making things slower than re-reading.",
                success: (snap) =>
                    snap.stages.some((s) => s.gcMs > 2000 || s.spillMB > 100),
            },
            {
                id: "cs_s2",
                title: "Turn off cache (counter-intuitive)",
                prompt:
                    "Disable **Cache After Clean**. Does runtime improve by removing the GC/write overhead?",
                expectedKnobDiff: { cacheAfterClean: false },
                rationale:
                    "Sometimes recomputing is cheaper than spilling cached data to disk and reading it back.",
                success: (_snap, knobs) => !knobs.cacheAfterClean,
            },
            {
                id: "cs_s3",
                title: "Shrink the payload",
                prompt:
                    "Enable **Project Early** and **Filter Early** to reduce the dataset size.",
                expectedKnobDiff: { projectEarly: true, filterEarly: true },
                rationale:
                    "If you must cache, cache as little as possible. Filtering and projecting first reduces the memory footprint.",
                success: (_snap, knobs) => knobs.projectEarly && knobs.filterEarly,
            },
            {
                id: "cs_s4",
                title: "Try caching again (selectively)",
                prompt:
                    "Now that data is smaller, try **Cache After Clean** again. Is it a win now?",
                expectedKnobDiff: { cacheAfterClean: true },
                rationale:
                    "With a smaller footprint, the dataset might fit in memory, making caching beneficial again for downstream reuse.",
                success: (snap, knobs) =>
                    knobs.cacheAfterClean &&
                    snap.scorecard.runtimeMin < 30 &&
                    snap.stages.every((s) => s.spillMB < 50),
            },
        ],
    },

    dpp_tuning: {
        id: "dpp_tuning",
        title: "Mission 6 — Dynamic Partition Pruning",
        subtitle:
            "Fact table partitioned by date. Join with dimension filters. DPP helps only in certain shapes.",
        slaMinutes: 25,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            dynamicPruning: false,
            filterEarly: false,
            projectEarly: false,
            aqe: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            dynamicPruning: false,
            filterEarly: false,
            projectEarly: false,
            aqe: false,
        }),
        coachSteps: [
            {
                id: "dpp_s1",
                title: "Analyze the scan",
                prompt:
                    "Look at the first stage. It's a full scan of the fact table despite joining with a filtered dimension.",
                expectedKnobDiff: {},
                rationale:
                    "Without DPP, Spark reads all partitions of the fact table, then joins and filters. This is wasteful.",
                success: (snap) => snap.stages[0].durationMs > 50000,
            },
            {
                id: "dpp_s2",
                title: "Enable Dynamic Pruning",
                prompt:
                    "Turn on **Dynamic Pruning**. Watch the scan stage duration and shuffle read.",
                expectedKnobDiff: { dynamicPruning: true },
                rationale:
                    "DPP reuses the filter from the dimension side to prune partitions on the fact side at scan time.",
                success: (_snap, knobs) => knobs.dynamicPruning,
            },
            {
                id: "dpp_s3",
                title: "Filter early (Dimension)",
                prompt:
                    "Ensure **Filter Early** is on. DPP needs a selective filter on the join key/dimension to be effective.",
                expectedKnobDiff: { filterEarly: true },
                rationale:
                    "If the dimension isn't filtered significantly, DPP won't prune much from the fact table.",
                success: (_snap, knobs) => knobs.filterEarly,
            },
            {
                id: "dpp_s4",
                title: "Verify plan",
                prompt:
                    "Check the Plan Diff. You should see 'DynamicPruning' or 'PartitionFilters' in the scan.",
                expectedKnobDiff: {},
                rationale:
                    "The physical plan confirms that the runtime filter is being applied to the file scan.",
                success: (snap) =>
                    snap.plan.after.includes("DynamicPruning") ||
                    snap.plan.after.includes("PartitionFilters"),
            },
        ],
    },

    udf_native: {
        id: "udf_native",
        title: "Mission 7 — UDF vs Built-in Functions",
        subtitle:
            "Python UDF inside aggregation. CPU-bound stage dominates. Teaches Catalyst optimization limits.",
        slaMinutes: 15,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            useUdf: true,
            aqe: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            useUdf: true,
            aqe: false,
        }),
        coachSteps: [
            {
                id: "udf_s1",
                title: "Identify the bottleneck",
                prompt:
                    "Look at the stage metrics. High Duration but low Spill/Shuffle suggests a CPU bottleneck.",
                expectedKnobDiff: {},
                rationale:
                    "Python UDFs force Spark to serialize data to Python, process it, and deserialize it back. This kills performance and blocks Catalyst optimizations.",
                success: (snap) => snap.stages.some((s) => s.durationMs > 20000),
            },
            {
                id: "udf_s2",
                title: "Switch to Native Functions",
                prompt:
                    "Disable **Use Python UDF**. This replaces the custom logic with Spark SQL built-ins.",
                expectedKnobDiff: { useUdf: false },
                rationale:
                    "Built-in functions run directly in the JVM and allow Catalyst to generate optimized bytecode (Whole-Stage Codegen).",
                success: (_snap, knobs) => !knobs.useUdf,
            },
            {
                id: "udf_s3",
                title: "Verify improvement",
                prompt:
                    "Check the runtime. It should drop dramatically without any shuffle/spill changes.",
                expectedKnobDiff: {},
                rationale:
                    "Removing the Python serialization overhead and enabling codegen makes CPU-bound tasks orders of magnitude faster.",
                success: (snap) => snap.scorecard.runtimeMin < 10,
            },
        ],
    },

    wide_schema: {
        id: "wide_schema",
        title: "Mission 8 — Wide Schema & Serialization Cost",
        subtitle:
            "200+ columns. Minimal logic, still slow. Teaches serialization cost and column pruning.",
        slaMinutes: 20,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            projectEarly: false,
            filterEarly: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            projectEarly: false,
            filterEarly: false,
        }),
        coachSteps: [
            {
                id: "wide_s1",
                title: "Analyze the I/O",
                prompt:
                    "Even with simple logic, the scan and shuffle write are huge. Why?",
                expectedKnobDiff: {},
                rationale:
                    "Reading and shuffling 200+ columns is expensive, even if you only use 5 of them. Serialization costs add up.",
                success: (snap) => snap.stages[0].shuffleWriteMB > 500,
            },
            {
                id: "wide_s2",
                title: "Prune columns early",
                prompt:
                    "Enable **Project Early**. This selects only the columns needed for the calculation.",
                expectedKnobDiff: { projectEarly: true },
                rationale:
                    "Column pruning reduces the amount of data read from Parquet/Delta and the amount of data shuffled.",
                success: (_snap, knobs) => knobs.projectEarly,
            },
            {
                id: "wide_s3",
                title: "Verify throughput",
                prompt:
                    "Check the Shuffle Write size. It should be a fraction of the original.",
                expectedKnobDiff: {},
                rationale:
                    "Less data to move means faster stages and less network/disk I/O.",
                success: (snap) => snap.stages[0].shuffleWriteMB < 100,
            },
        ],
    },

    multi_join: {
        id: "multi_join",
        title: "Mission 9 — Multi-Join Explosion",
        subtitle:
            "5-way join. Join order matters more than any single knob. Teaches join reordering.",
        slaMinutes: 40,
        baselineKnobs: mergeKnobs(defaultKnobs, {
            optimizeJoinOrder: false,
            aqe: false,
            broadcastCustomers: false,
        }),
        initialKnobs: mergeKnobs(defaultKnobs, {
            optimizeJoinOrder: false,
            aqe: false,
            broadcastCustomers: false,
        }),
        coachSteps: [
            {
                id: "mj_s1",
                title: "Spot the explosion",
                prompt:
                    "Look at the intermediate join stage. It has massive spill and shuffle. The plan likely joins big tables first.",
                expectedKnobDiff: {},
                rationale:
                    "Joining two large tables first creates a massive intermediate result. It's better to join small tables or filter early.",
                success: (snap) => snap.stages.some((s) => s.spillMB > 500),
            },
            {
                id: "mj_s2",
                title: "Optimize Join Order",
                prompt:
                    "Enable **Optimize Join Order** (CBO/AQE). This lets Spark reorder joins based on size.",
                expectedKnobDiff: { optimizeJoinOrder: true },
                rationale:
                    "Spark can reorder joins to minimize intermediate data size (e.g., join small dimension tables first).",
                success: (_snap, knobs) => knobs.optimizeJoinOrder,
            },
            {
                id: "mj_s3",
                title: "Try Broadcast",
                prompt:
                    "If there are small tables, ensure **Broadcast** is enabled (or let AQE decide).",
                expectedKnobDiff: { broadcastCustomers: true },
                rationale:
                    "Broadcasting small tables avoids shuffling the large fact table, further speeding up the multi-way join.",
                success: (_snap, knobs) => knobs.broadcastCustomers,
            },
        ],
    },
};
