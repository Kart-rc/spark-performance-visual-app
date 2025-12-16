import { BookOpen, AlertCircle, CheckCircle2 } from "lucide-react";
import { MissionId } from "@/types";
import { useSimStore } from "@/store/useSimStore";
import { missions } from "@/data/missions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LearningPanel({ missionId }: { missionId: MissionId }) {
    const learningMode = useSimStore((s) => s.learningMode);
    const currentStep = useSimStore((s) => s.currentStep);
    const setCurrentStep = useSimStore((s) => s.setCurrentStep);
    const applyStepByIndex = useSimStore((s) => s.applyStepByIndex);
    const snap = useSimStore((s) => s.snapshot);
    const knobs = useSimStore((s) => s.knobs);

    if (!learningMode) return null;

    const mission = missions[missionId];
    const steps = mission.coachSteps;
    const completed = steps.filter((step) => step.success(snap, knobs)).length;
    const progressPct = Math.round((completed / steps.length) * 100);

    return (
        <Card className="rounded-2xl border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-lg">
            <CardHeader className="pb-3 border-b bg-white/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <CardTitle className="text-base text-indigo-900 dark:text-indigo-100">
                        Mission Guide
                    </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                    Step-by-step walkthrough for {mission.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <div className="relative h-2 w-28 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/60">
                            <div
                                className="absolute left-0 top-0 h-full bg-indigo-500 transition-all"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                            {completed}/{steps.length} complete
                        </span>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentStep(completed)}
                        className="h-8 px-3 text-xs"
                    >
                        Resume at step {Math.min(completed + 1, steps.length)}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[500px] p-4">
                    <div className="space-y-6">
                        {steps.map((step, idx) => {
                            const isDone = step.success(snap, knobs);
                            const isActive = idx === currentStep;
                            return (
                                <div
                                    key={step.id}
                                    className={cn(
                                        "relative pl-6 pb-6 border-l last:border-0 transition-colors",
                                        isDone
                                            ? "border-green-300 dark:border-green-800"
                                            : isActive
                                                ? "border-indigo-400 dark:border-indigo-700"
                                                : "border-indigo-200 dark:border-indigo-800"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "absolute -left-3 top-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold",
                                            isDone
                                                ? "bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                                                : isActive
                                                    ? "bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                                                    : "bg-indigo-50 dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                                        )}
                                    >
                                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-medium text-sm text-foreground">
                                            {step.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground bg-white dark:bg-slate-900 p-3 rounded-lg border">
                                            {step.prompt}
                                        </p>

                                        <div className="flex gap-2 items-start mt-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 p-3 rounded-lg">
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>{step.rationale}</span>
                                        </div>

                                        {Object.keys(step.expectedKnobDiff).length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {Object.entries(step.expectedKnobDiff).map(([key, value]) => (
                                                    <Badge key={key} variant="secondary" className="text-[10px] font-mono">
                                                        {key}: {String(value)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                size="sm"
                                                variant={isDone ? "secondary" : "outline"}
                                                onClick={() => setCurrentStep(idx)}
                                                className="rounded-xl"
                                            >
                                                {isDone ? "Review" : "Go to step"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => applyStepByIndex(idx)}
                                                className="rounded-xl"
                                                variant={isDone ? "outline" : "default"}
                                            >
                                                {isDone ? "Reapply change" : "Apply suggested change"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                        <div className="space-y-1">
                            <div className="font-semibold text-sm text-green-700 dark:text-green-300">Definition of Done</div>
                            <p className="text-xs text-green-600 dark:text-green-400">
                                Follow these steps to meet the SLA of {mission.slaMinutes} minutes. The simulator will track your progress as you apply these changes.
                            </p>
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
