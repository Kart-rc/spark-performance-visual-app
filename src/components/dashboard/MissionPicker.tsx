import { Info } from "lucide-react";
import { useSimStore } from "@/store/useSimStore";
import { missions } from "@/data/missions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function MissionPicker() {
    const setMission = useSimStore((s) => s.setMission);

    return (
        <div className="min-h-screen p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                            SparkTune Flight Simulator
                        </h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">
                            Learn Databricks Spark performance tuning for complex ETL + CDC
                            MERGE workflows using a guided, Spark UI-like simulator. No
                            repartition knobs—only real-world levers.
                        </p>
                    </div>
                    <Badge className="mt-2">Phase 1</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-8">
                    {Object.values(missions).map((m) => (
                        <Card key={m.id} className="rounded-2xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-xl">{m.title}</CardTitle>
                                <p className="text-sm text-muted-foreground">{m.subtitle}</p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Info className="w-4 h-4" />
                                    <span>Target SLA:</span>
                                    <Badge variant="outline">{m.slaMinutes} min</Badge>
                                </div>
                                <Button className="w-full" onClick={() => setMission(m.id)}>
                                    Start mission
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="mt-8 rounded-2xl">
                    <CardHeader>
                        <CardTitle className="text-lg">How to use this app</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>
                            1) Observe stage metrics and the plan. 2) Hypothesize root cause
                            (shuffle/spill/skew or file overhead). 3) Tune allowed knobs and
                            validate.
                        </p>
                        <p>
                            Use <b>Coach Mode</b> for a guided path, or explore freely.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
