import { Snapshot, StageMetric, MetricTarget } from "@/types";

/**
 * Extract metric values from snapshot for analysis
 */
export function extractMetricValue(snap: Snapshot, metric: string): number {
    switch (metric) {
        case "shuffle":
            return snap.stages.reduce(
                (sum, s) => sum + s.shuffleReadMB + s.shuffleWriteMB,
                0
            );
        case "spill":
            return snap.stages.reduce((sum, s) => sum + s.spillMB, 0);
        case "skew":
            return Math.max(...snap.stages.map((s) => s.skewScore), 0);
        case "gc":
            return snap.stages.reduce((sum, s) => sum + s.gcMs, 0);
        case "duration":
            return snap.scorecard.runtimeMin;
        case "fileImpact":
            return snap.scorecard.fileImpactPct ?? 0;
        case "taskCount":
            return snap.stages.length; // Proxy for parallelism
        default:
            return 0;
    }
}

/**
 * Compare metric value against threshold
 */
function compareMetric(
    actual: number,
    threshold: number,
    comparison: string
): boolean {
    switch (comparison) {
        case ">":
            return actual > threshold;
        case "<":
            return actual < threshold;
        case ">=":
            return actual >= threshold;
        case "<=":
            return actual <= threshold;
        default:
            return false;
    }
}

/**
 * Evaluate if a metric target is met
 */
export function evaluateMetricTarget(
    snap: Snapshot,
    target: MetricTarget
): { met: boolean; actual: number; context: string } {
    const actual = extractMetricValue(snap, target.metric);
    const met = compareMetric(actual, target.threshold, target.comparison);
    return { met, actual, context: target.context };
}

/**
 * Calculate improvement percentage between two values
 */
export function calculateImprovement(baseline: number, current: number): number {
    if (baseline === 0) return 0;
    return Math.round(((baseline - current) / baseline) * 100);
}

/**
 * Identify the bottleneck stage based on multiple factors
 */
export function identifyBottleneck(stages: StageMetric[]): {
    stage: StageMetric;
    reason: "Duration" | "Shuffle" | "Spill" | "Skew";
} {
    if (stages.length === 0) {
        return {
            stage: {
                id: "unknown",
                name: "No stages",
                durationMs: 0,
                shuffleReadMB: 0,
                shuffleWriteMB: 0,
                spillMB: 0,
                gcMs: 0,
                skewScore: 0,
            },
            reason: "Duration",
        };
    }

    // Score each stage based on different metrics
    const scoreStage = (s: StageMetric) => {
        return (
            s.durationMs * 0.4 +
            (s.shuffleReadMB + s.shuffleWriteMB) * 100 +
            s.spillMB * 200 +
            s.skewScore * 50000
        );
    };

    const worst = stages.reduce((a, b) => (scoreStage(a) > scoreStage(b) ? a : b));

    // Determine primary reason for bottleneck
    let reason: "Duration" | "Shuffle" | "Spill" | "Skew" = "Duration";
    if (worst.spillMB > 100) reason = "Spill";
    else if (worst.shuffleReadMB + worst.shuffleWriteMB > 300) reason = "Shuffle";
    else if (worst.skewScore > 0.7) reason = "Skew";

    return { stage: worst, reason };
}

/**
 * Generate diagnostic feedback based on metric targets
 */
export function generateDiagnosticFeedback(
    targets: MetricTarget[],
    snap: Snapshot
): string {
    const results = targets.map((t) => evaluateMetricTarget(snap, t));
    const met = results.filter((r) => r.met);

    if (met.length === 0) {
        return "No diagnostic criteria met yet. Review the metrics panel.";
    } else if (met.length < results.length) {
        return `Partial diagnosis: ${met.length}/${results.length} indicators observed.`;
    } else {
        return "Diagnosis complete! All indicators identified correctly.";
    }
}

/**
 * Format metric value for display
 */
export function formatMetricValue(metric: string, value: number): string {
    switch (metric) {
        case "skew":
            return `${(value * 100).toFixed(0)}%`;
        case "duration":
            return `${value.toFixed(0)} min`;
        case "shuffle":
        case "spill":
            return `${value.toFixed(0)} MB`;
        case "gc":
            return `${value.toFixed(0)} ms`;
        case "fileImpact":
            return `${value.toFixed(0)}%`;
        case "taskCount":
            return `${value.toFixed(0)} tasks`;
        default:
            return value.toFixed(2);
    }
}
