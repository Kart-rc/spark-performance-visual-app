import { ChevronsLeftRight, RotateCcw, BookOpen } from "lucide-react";
import { useSimStore } from "@/store/useSimStore";
import { missions } from "@/data/missions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


export function TopBar() {
    const missionId = useSimStore((s) => s.missionId);
    const reset = useSimStore((s) => s.reset);
    const compareBaseline = useSimStore((s) => s.compareBaseline);
    const toggleCompare = useSimStore((s) => s.toggleCompare);
    const learningMode = useSimStore((s) => s.learningMode);
    const toggleLearningMode = useSimStore((s) => s.toggleLearningMode);




    const m = missionId ? missions[missionId] : null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => useSimStore.getState().setMission(null)}
            >
                <div className="text-lg font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                    SparkTune Flight Simulator
                </div>
                {m && <Badge variant="outline">SLA {m.slaMinutes}m</Badge>}
            </div>

            {m && (
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border">
                        <ChevronsLeftRight className="w-4 h-4" />
                        <span className="text-sm hidden md:inline">Compare</span>
                        <Switch checked={compareBaseline} onCheckedChange={toggleCompare} />
                    </div>

                    <Button
                        variant={learningMode ? "default" : "outline"}
                        onClick={toggleLearningMode}
                        className="rounded-xl flex items-center gap-2"
                    >
                        <BookOpen className="w-4 h-4" />
                        <span className="hidden md:inline">Guide</span>
                    </Button>

                    <Button variant="outline" onClick={reset} className="rounded-xl">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                </div>
            )}


        </div>
    );
}
