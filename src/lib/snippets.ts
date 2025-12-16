import { Knobs, MissionId } from "@/types";

export function etlSnippet(missionId: MissionId, knobs: Knobs) {
    const conf: string[] = [];
    conf.push(
        `spark.conf.set("spark.sql.adaptive.enabled", "${knobs.aqe ? "true" : "false"
        }")`
    );

    const proj = knobs.projectEarly
        ? `.select("order_id","customer_id","order_date","amount")`
        : "";

    const filt = knobs.filterEarly
        ? `.where(F.col("order_date") >= F.lit("2025-06-01"))`
        : "";

    const broadcast =
        knobs.broadcastCustomers && knobs.broadcastThresholdMB >= 10
            ? "F.broadcast(customers_filtered)"
            : "customers_filtered";

    const cache = knobs.cacheAfterClean ? ".cache()" : "";

    const skewHint =
        missionId === "skew_tail"
            ? "\n# Skew mission: watch long-tail tasks; avoid repartition knobs; prefer AQE + reduce payload before hotspot\n"
            : "\n";

    return `from pyspark.sql import functions as F\n\n${conf.join(
        "\n"
    )}\n\ncustomers_filtered = customers.select(\"customer_id\",\"country\").where(\"country='US'\")\n\n${skewHint}clean = orders${proj}${filt}${cache}\n\ndf = (clean\n  .join(${broadcast}, \"customer_id\")\n  .groupBy(\"country\", \"order_date\")\n  .agg(F.sum(\"amount\").alias(\"rev\"))\n)\n\ndf.write.format(\"delta\").mode(\"overwrite\").saveAsTable(\"gold_daily_revenue\")\n`;
}

export function mergeSnippet(knobs: Knobs) {
    const prep = knobs.preDedupCdc
        ? `-- Pre-dedup CDC to latest per key
CREATE OR REPLACE TEMP VIEW cdc_latest AS
SELECT * FROM (
  SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY _ingest_ts DESC) rn
  FROM cdc_orders
) WHERE rn = 1;

`
        : "";

    const update = knobs.updateOnlyChangedCols
        ? `WHEN MATCHED AND (t.amount <> s.amount) THEN UPDATE SET amount = s.amount
`
        : `WHEN MATCHED THEN UPDATE SET *
`;

    const layoutHints = `-- Table maintenance (conceptual)
-- OPTIMIZE: ${knobs.optimizeBeforeMerge ? "enabled" : "disabled"}
-- ZORDER: ${knobs.zOrderOnKeys ? "enabled" : "disabled"}

`;

    return `${layoutHints}${prep}MERGE INTO fact_orders t
USING ${knobs.preDedupCdc ? "cdc_latest" : "cdc_orders"} s
ON t.order_id = s.order_id
${update}WHEN NOT MATCHED THEN INSERT *;
`;
}

export function smallFilesSnippet(knobs: Knobs) {
    return `-- Small files mission (Delta)
-- Symptoms: high file listing/open overhead, IO dominated stages

-- 1) Prefer projection and filters early
SELECT ${knobs.projectEarly ? "only_needed_cols" : "*"}
FROM big_delta_table
${knobs.filterEarly
            ? "WHERE date >= '2025-06-01'"
            : "-- WHERE ... (pushdown-friendly predicate)"
        }
;

-- 2) Compact files (conceptual)
-- OPTIMIZE: ${knobs.optimizeBeforeMerge ? "enabled" : "disabled"}
-- ZORDER: ${knobs.zOrderOnKeys ? "enabled" : "disabled"}

OPTIMIZE big_delta_table${knobs.zOrderOnKeys ? " ZORDER BY (key_col)" : ""};
`;
}

export function cacheSnippet(knobs: Knobs) {
    return `# Mission 5: Cache trade-offs
# If dataset is too big, .cache() causes spill (DISK_AND_MEMORY)
# Fix: Project/Filter FIRST, then cache.

raw = spark.read.table("huge_log_table")

# ${knobs.projectEarly ? "Enabled" : "Disabled"}: Column pruning
df = raw${knobs.projectEarly ? '.select("event_id", "user_id", "timestamp")' : ""
        }

# ${knobs.filterEarly ? "Enabled" : "Disabled"}: Filter early
df = df${knobs.filterEarly ? '.filter("timestamp > current_date() - 7")' : ""}

# ${knobs.cacheAfterClean ? "Enabled" : "Disabled"}: Caching
# If df is still huge, this will explode storage/GC
${knobs.cacheAfterClean ? "df = df.cache()" : "# df not cached"}

df.count() # Trigger cache
df.groupBy("user_id").count().show()
`;
}

export function dppSnippet(knobs: Knobs) {
    return `-- Mission 6: Dynamic Partition Pruning (DPP)
-- Fact table is partitioned by 'date'
-- Dimension table 'dim_date' is small

-- Spark can inject the filter from dim_date into the scan of fact_sales
-- BUT only if:
-- 1. DPP is enabled
-- 2. The join key matches the partition key
-- 3. The dimension filter is selective

SET spark.sql.optimizer.dynamicPartitionPruning.enabled = ${knobs.dynamicPruning
        };

SELECT *
FROM fact_sales f
JOIN dim_date d ON f.date = d.date
WHERE ${knobs.filterEarly
            ? "d.year = 2025 AND d.month = 6"
            : "-- No strong filter on dimension (DPP won't prune much)"
        };
`;
}

export function udfSnippet(knobs: Knobs) {
    return `# Mission 7: UDF vs Built-in
# Python UDFs cause serialization overhead (Pickle) and block Catalyst.

${knobs.useUdf
            ? `# SLOW: Python UDF
@udf(returnType=IntegerType())
def my_udf(val):
    return val + 1

df.select(my_udf("val"))`
            : `# FAST: Native Spark SQL
# Catalyst can generate optimized bytecode (Whole-Stage Codegen)
from pyspark.sql.functions import col

df.select(col("val") + 1)`
        }
`;
}

export function wideSchemaSnippet(knobs: Knobs) {
    return `-- Mission 8: Wide Schema
-- Reading 200+ columns is expensive even if you don't use them all.

${knobs.projectEarly
            ? `-- GOOD: Select only what you need
SELECT id, val FROM wide_table`
            : `-- BAD: Select * (reads all 200 columns)
SELECT * FROM wide_table`
        }
`;
}

export function multiJoinSnippet(knobs: Knobs) {
    return `-- Mission 9: Multi-Join
-- Joining large tables first creates massive intermediate data.

${knobs.optimizeJoinOrder
            ? `-- GOOD: CBO/AQE reorders joins (Small -> Big)
SET spark.sql.cbo.enabled = true;
SET spark.sql.adaptive.enabled = true;`
            : `-- BAD: Default order might be suboptimal
-- (Spark joins tables in the order they appear in FROM/JOIN)`
        }

SELECT *
FROM A
JOIN B ON A.id = B.id
JOIN C ON A.id = C.id
...
`;
}
