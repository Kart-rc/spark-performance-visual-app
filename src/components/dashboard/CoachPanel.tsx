import { CheckCircle2, Info } from "lucide-react";
import { MissionId, Snapshot } from "@/types";
import { useSimStore } from "@/store/useSimStore";
import { missions } from "@/data/missions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function CoachPanel({ snap }: { snap: Snapshot }) {
    const missionId = useSimStore((s) => s.missionId) as MissionId;
    const learningMode = useSimStore((s) => s.learningMode);
    const coachIndex = useSimStore((s) => s.currentStep);
    const next = useSimStore((s) => s.nextStep);
    const prev = useSimStore((s) => s.prevStep);
    const jump = useSimStore((s) => s.setCurrentStep);
    const apply = useSimStore((s) => s.applyStep);
    const knobs = useSimStore((s) => s.knobs)!;

    const steps = missions[missionId].coachSteps;
    const step = steps[coachIndex];
    const done = step.success(snap, knobs);
    const allDone = steps.every((s) => s.success(snap, knobs));

    if (!learningMode) return null;

    if (allDone) {
        return (
            <Card className="rounded-2xl border-green-500/50 bg-green-500/10">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <CardTitle className="text-lg text-green-700">
                            Mission Complete!
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-green-800 mb-4">
                        Excellent work! You've optimized the pipeline and met the SLA.
                    </p>
                    <Button onClick={() => useSimStore.getState().setMission(null)}>
                        Back to Missions
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Coach mode</CardTitle>
                    <Badge variant="outline">
                        Step {coachIndex + 1}/{steps.length}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                    {done ? (
                        <CheckCircle2 className="w-5 h-5 mt-0.5" />
                    ) : (
                        <Info className="w-5 h-5 mt-0.5" />
                    )}
                    <div className="min-w-0">
                        <div className="font-semibold text-sm">{step.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                            {step.prompt}
                        </div>
                    </div>
                </div>

                <div className="p-3 rounded-2xl border text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground mb-1">
                        Why this helps
                    </div>
                    {step.rationale}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={prev}
                        className="rounded-xl"
                        disabled={coachIndex === 0}
                    >
                        Back
                    </Button>
                    <Button onClick={apply} className="rounded-xl">
                        Apply step
                    </Button>
                    <Button
                        variant="outline"
                        onClick={next}
                        className="rounded-xl"
                        disabled={coachIndex === steps.length - 1}
                    >
                        Next
                    </Button>
                    <div className="ml-auto">
                        <Badge variant={done ? "secondary" : "outline"}>
                            {done ? "Completed" : "Not yet"}
                        </Badge>
                    </div>
                </div>

                <Separator />
                <div className="flex flex-wrap gap-2">
                    {steps.map((_, idx) => (
                        <Button
                            key={idx}
                            size="sm"
                            variant={idx === coachIndex ? "default" : "outline"}
                            onClick={() => jump(idx)}
                            className="rounded-xl"
                        >
                            {idx + 1}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
