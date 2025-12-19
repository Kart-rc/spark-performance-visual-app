import { Scale, AlertTriangle } from "lucide-react";
import { CoachStep } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TradeoffPanel({ step }: { step: CoachStep }) {
    if (!step.tradeoffs) return null;

    // Parse tradeoffs for display (simple approach)
    const hasRepartition = step.id.includes("repartition") || step.tradeoffs.toLowerCase().includes("repartition");
    const hasCoalesce = step.id.includes("coalesce") || step.tradeoffs.toLowerCase().includes("coalesce");

    return (
        <Card className="rounded-2xl border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-orange-900 dark:text-orange-100">
                    <Scale className="w-4 h-4" />
                    Tradeoffs to Consider
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-orange-800 dark:text-orange-300">
                        {step.tradeoffs}
                    </p>
                </div>

                {/* Cost/Benefit breakdown for known operations */}
                {hasRepartition && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <div className="text-xs font-semibold text-red-900 dark:text-red-200">
                                Cost
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                                +15% duration
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300">
                                Full shuffle overhead
                            </div>
                        </div>
                        <div className="p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                            <div className="text-xs font-semibold text-green-900 dark:text-green-200">
                                Benefit
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                                -50% skew
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300">
                                Even distribution
                            </div>
                        </div>
                    </div>
                )}

                {hasCoalesce && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                            <div className="text-xs font-semibold text-red-900 dark:text-red-200">
                                Cost
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                                +5% write duration
                            </div>
                            <div className="text-xs text-red-700 dark:text-red-300">
                                Less parallelism
                            </div>
                        </div>
                        <div className="p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                            <div className="text-xs font-semibold text-green-900 dark:text-green-200">
                                Benefit
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                                Prevent 100s of small files
                            </div>
                            <div className="text-xs text-green-700 dark:text-green-300">
                                Faster future reads
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
