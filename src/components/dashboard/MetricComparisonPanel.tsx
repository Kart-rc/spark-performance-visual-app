import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { StepValidationResult } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricComparisonPanel({
    validation,
}: {
    validation: StepValidationResult;
}) {
    if (!validation.metricDeltas || validation.metricDeltas.length === 0) {
        return null;
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Metric Impact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {validation.metricDeltas.map((delta, idx) => {
                    const change = delta.after - delta.before;
                    const pctChange =
                        delta.before !== 0
                            ? Math.abs((change / delta.before) * 100)
                            : 0;
                    const improving = change < 0; // Lower is better for most metrics
                    const progressToTarget =
                        delta.target !== 0
                            ? Math.min(
                                  100,
                                  Math.max(
                                      0,
                                      ((delta.before - delta.after) /
                                          (delta.before - delta.target)) *
                                          100
                                  )
                              )
                            : 0;

                    return (
                        <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{delta.metric}</span>
                                <div className="flex items-center gap-2">
                                    {improving ? (
                                        <TrendingDown className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : change > 0 ? (
                                        <TrendingUp className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    ) : (
                                        <Minus className="w-4 h-4 text-slate-400" />
                                    )}
                                    <span
                                        className={`text-sm font-semibold ${
                                            improving
                                                ? "text-green-600 dark:text-green-400"
                                                : change > 0
                                                  ? "text-red-600 dark:text-red-400"
                                                  : "text-slate-600 dark:text-slate-400"
                                        }`}
                                    >
                                        {change > 0 ? "+" : ""}
                                        {change.toFixed(0)} ({pctChange.toFixed(1)}%)
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">
                                    {delta.before.toFixed(0)} → {delta.after.toFixed(0)}
                                </span>
                                <span className="text-muted-foreground">
                                    (target: {delta.target.toFixed(0)})
                                </span>
                            </div>
                            {/* Simple progress bar */}
                            <div className="relative h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                    className={`absolute left-0 top-0 h-full transition-all ${
                                        improving
                                            ? "bg-green-500 dark:bg-green-600"
                                            : "bg-amber-500 dark:bg-amber-600"
                                    }`}
                                    style={{ width: `${progressToTarget}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
