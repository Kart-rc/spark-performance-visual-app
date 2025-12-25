import { useSimStore } from "@/store/useSimStore";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OtelTraceViewer } from "./OtelTraceViewer";
import { LineageGraphViewer } from "./LineageGraphViewer";
import { Activity, GitBranch } from "lucide-react";

export function ObservabilityPanel() {
    const lineageGraph = useSimStore((s) => s.lineageGraph);
    const missionId = useSimStore((s) => s.missionId);

    if (!missionId) {
        return null;
    }

    return (
        <Card className="p-4">
            <Tabs defaultValue="lineage" className="h-[600px] flex flex-col">
                <TabsList className="mb-4">
                    <TabsTrigger value="lineage" className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        App Lineage
                    </TabsTrigger>
                    <TabsTrigger value="traces" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Telemetry Traces
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="lineage" className="flex-1 m-0">
                    {lineageGraph ? (
                        <LineageGraphViewer lineageGraph={lineageGraph} />
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            No lineage data available
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="traces" className="flex-1 m-0">
                    <OtelTraceViewer />
                </TabsContent>
            </Tabs>
        </Card>
    );
}
