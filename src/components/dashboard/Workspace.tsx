import { useMemo } from "react";

import { useSimStore } from "@/store/useSimStore";
import { missions } from "@/data/missions";
import { simulate } from "@/lib/simulation";
import {
    etlSnippet,
    mergeSnippet,
    smallFilesSnippet,
    cacheSnippet,
    dppSnippet,
    udfSnippet,
    wideSchemaSnippet,
    multiJoinSnippet,
} from "@/lib/snippets";

import { TopBar } from "./TopBar";
import { DagPanel } from "./DagPanel";
import { KnobPanel } from "./KnobPanel";
import { LearningPanel } from "./LearningPanel";

import { SparkUISim } from "./SparkUISim";
import { PartitionOrFileAnim } from "./PartitionOrFileAnim";
import { PlanDiff } from "./PlanDiff";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

import { GeminiAssistant } from "./GeminiAssistant";
import { ObservabilityPanel } from "./ObservabilityPanel";

export function Workspace() {
    const missionId = useSimStore((s) => s.missionId);
    const setMission = useSimStore((s) => s.setMission);
    const knobs = useSimStore((s) => s.knobs);
    const snap = useSimStore((s) => s.snapshot);

    const baselineSnap = useMemo(() => {
        if (!missionId) return null;
        const m = missions[missionId];
        return simulate(missionId, m.baselineKnobs);
    }, [missionId]);

    if (!missionId) {
        return (
            <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
                <TopBar />
                <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
                    <div className="mb-8 text-center space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                            Select a Mission
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Choose a scenario to debug and optimize.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.values(missions).map((m) => (
                            <Card
                                key={m.id}
                                className="cursor-pointer hover:shadow-lg transition-all hover:border-indigo-500 group"
                                onClick={() => setMission(m.id)}
                            >
                                <CardHeader>
                                    <CardTitle className="group-hover:text-indigo-600 transition-colors">
                                        {m.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        {m.subtitle}
                                    </p>
                                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                                        <span>SLA: {m.slaMinutes}m</span>
                                        <span>{m.coachSteps.length} steps</span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const defaultTab =
        missionId === "cdc_merge"
            ? "merge"
            : missionId === "small_files"
                ? "files"
                : missionId === "cache_spill"
                    ? "cache"
                    : missionId === "dpp_tuning"
                        ? "dpp"
                        : missionId === "udf_native"
                            ? "udf"
                            : missionId === "wide_schema"
                                ? "wide"
                                : missionId === "multi_join"
                                    ? "join"
                                    : "etl";

    return (
        <div className="min-h-screen flex flex-col">
            <TopBar />

            <div className="flex-1 p-4 md:p-6">
                <div className="grid lg:grid-cols-12 gap-6 max-w-[1400px] mx-auto">
                    <div className="lg:col-span-4 space-y-6">
                        <LearningPanel missionId={missionId} />
                        <DagPanel missionId={missionId} />
                        <KnobPanel missionId={missionId} />
                        <GeminiAssistant />
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <SparkUISim
                            snap={snap}
                            baselineSnap={baselineSnap!}
                            missionId={missionId}
                        />
                        <div className="grid md:grid-cols-2 gap-6">
                            <PartitionOrFileAnim snap={snap} missionId={missionId} />
                            <PlanDiff snap={snap} baselineSnap={baselineSnap!} />
                        </div>

                        <ObservabilityPanel />

                        <Card className="rounded-2xl">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">
                                    Copy/paste snippets (MVP)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue={defaultTab}>
                                    <TabsList>
                                        <TabsTrigger value="etl">ETL</TabsTrigger>
                                        <TabsTrigger value="merge">MERGE</TabsTrigger>
                                        <TabsTrigger value="files">Small files</TabsTrigger>
                                        <TabsTrigger value="cache">Cache</TabsTrigger>
                                        <TabsTrigger value="dpp">DPP</TabsTrigger>
                                        <TabsTrigger value="udf">UDF</TabsTrigger>
                                        <TabsTrigger value="wide">Wide</TabsTrigger>
                                        <TabsTrigger value="join">Join</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="etl" className="mt-3">
                                        <CodeBlock code={etlSnippet(missionId, knobs)} />
                                    </TabsContent>
                                    <TabsContent value="merge" className="mt-3">
                                        <CodeBlock code={mergeSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="files" className="mt-3">
                                        <CodeBlock code={smallFilesSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="cache" className="mt-3">
                                        <CodeBlock code={cacheSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="dpp" className="mt-3">
                                        <CodeBlock code={dppSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="udf" className="mt-3">
                                        <CodeBlock code={udfSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="wide" className="mt-3">
                                        <CodeBlock code={wideSchemaSnippet(knobs)} />
                                    </TabsContent>
                                    <TabsContent value="join" className="mt-3">
                                        <CodeBlock code={multiJoinSnippet(knobs)} />
                                    </TabsContent>
                                </Tabs>
                                <p className="text-xs text-muted-foreground mt-2">
                                    These snippets are illustrative. In a full build you can link
                                    to Databricks notebooks and provide a mini dataset generator.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>

    );
}

function CodeBlock({ code }: { code: string }) {
    return (
        <div className="rounded-2xl border overflow-hidden">
            <ScrollArea className="h-56">
                <pre className="text-xs p-3 leading-relaxed">
                    <code>{code}</code>
                </pre>
            </ScrollArea>
        </div>
    );
}
