import { AlertCircle, Target, Lightbulb } from "lucide-react";
import { CoachStep, Snapshot } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { evaluateMetricTarget, formatMetricValue } from "@/lib/metricAnalysis";

export function DiagnosticPanel({
    step,
    snap,
}: {
    step: CoachStep;
    snap: Snapshot;
}) {
    if (step.type !== "diagnostic") return null;

    return (
        <Card className="rounded-2xl border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-base text-amber-900 dark:text-amber-100">
                        Diagnostic Phase
                    </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                    Identify the problem before applying fixes
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Problem Pattern */}
                {step.problemPattern && (
                    <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                                    What to Look For
                                </div>
                                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 whitespace-pre-line">
                                    {step.problemPattern}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Metrics to Watch */}
                {step.metricsToWatch?.before && step.metricsToWatch.before.length > 0 && (
                    <div className="space-y-2">
                        <div className="font-semibold text-sm">Diagnostic Criteria</div>
                        {step.metricsToWatch.before.map((target, idx) => {
                            const result = evaluateMetricTarget(snap, target);
                            return (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg border ${
                                        result.met
                                            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                                            : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-medium">
                                                {target.metric.charAt(0).toUpperCase() +
                                                    target.metric.slice(1)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {target.context}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">
                                                {formatMetricValue(target.metric, result.actual)}{" "}
                                                {target.comparison} {target.threshold}
                                            </div>
                                            <Badge variant={result.met ? "default" : "outline"}>
                                                {result.met ? "✓ Observed" : "Check UI"}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Real-world Scenario */}
                {step.realWorldScenario && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
                            <div>
                                <div className="font-semibold text-sm text-blue-900 dark:text-blue-100 mb-1">
                                    Production Context
                                </div>
                                <p className="text-xs text-blue-800 dark:text-blue-300 whitespace-pre-line">
                                    {step.realWorldScenario}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
