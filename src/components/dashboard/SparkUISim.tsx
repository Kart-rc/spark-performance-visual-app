import React from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { MissionId, Snapshot, StageMetric } from "@/types";
import { useSimStore } from "@/store/useSimStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function SparkUISim({
    snap,
    baselineSnap,
    missionId,
}: {
    snap: Snapshot;
    baselineSnap: Snapshot | null;
    missionId: MissionId;
}) {
    const compare = useSimStore((s) => s.compareBaseline);
    const series = stageSeries(snap.stages);
    const baseSeries = baselineSnap ? stageSeries(baselineSnap.stages) : null;

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Spark UI Simulator</CardTitle>
                    <Badge variant="outline">Stages: {snap.stages.length}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={series}
                            margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="stage" hide />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="tSec" dot={false} />
                            {compare && baseSeries && (
                                <Line
                                    type="monotone"
                                    dataKey="tSec"
                                    data={baseSeries}
                                    dot={false}
                                />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <MetricChip
                        label="Runtime"
                        value={`${snap.scorecard.runtimeMin} min`}
                    />
                    <MetricChip
                        label="Cost proxy"
                        value={`${snap.scorecard.costUnits} u`}
                    />
                    <MetricChip
                        label="SLA risk"
                        value={<RiskBadge risk={snap.scorecard.slaRisk} />}
                    />
                    {typeof snap.scorecard.fileImpactPct === "number" ? (
                        <MetricChip
                            label={fileMetricLabel(missionId)}
                            value={`${snap.scorecard.fileImpactPct}%`}
                        />
                    ) : (
                        <MetricChip label="Top issue" value={topIssue(snap.stages)} />
                    )}
                </div>

                <Separator />

                <div className="text-sm font-semibold">Stages</div>
                <div className="overflow-auto rounded-2xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="text-left p-3">Stage</th>
                                <th className="text-right p-3">Duration</th>
                                <th className="text-right p-3">Shuffle (MB)</th>
                                <th className="text-right p-3">Spill (MB)</th>
                                <th className="text-right p-3">GC</th>
                                <th className="text-right p-3">Skew</th>
                            </tr>
                        </thead>
                        <tbody>
                            {snap.stages.map((s) => (
                                <tr key={s.id} className="border-t">
                                    <td className="p-3 whitespace-nowrap">{s.name}</td>
                                    <td className="p-3 text-right">{formatMs(s.durationMs)}</td>
                                    <td className="p-3 text-right">
                                        {s.shuffleReadMB + s.shuffleWriteMB}
                                    </td>
                                    <td className="p-3 text-right">{s.spillMB}</td>
                                    <td className="p-3 text-right">{formatMs(s.gcMs)}</td>
                                    <td className="p-3 text-right">
                                        {Math.round(s.skewScore * 100)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="space-y-2">
                    <div className="text-sm font-semibold">Notes</div>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                        {snap.scorecard.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}

function MetricChip({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="p-3 rounded-2xl border">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-semibold mt-1">{value}</div>
        </div>
    );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
    const variant =
        risk === "low"
            ? "secondary"
            : risk === "medium"
                ? "outline"
                : "destructive";
    return <Badge variant={variant as any}>{risk.toUpperCase()}</Badge>;
}

function formatMs(ms: number) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function stageSeries(stages: StageMetric[]) {
    let t = 0;
    return stages.map((s) => {
        t += s.durationMs;
        return {
            stage: s.name,
            tSec: Math.round(t / 1000),
            shuffleMB: s.shuffleReadMB + s.shuffleWriteMB,
            spillMB: s.spillMB,
            gcMs: s.gcMs,
            skew: Math.round(s.skewScore * 100),
        };
    });
}

function fileMetricLabel(missionId: MissionId) {
    return missionId === "cdc_merge" ? "Files touched" : "Files scanned";
}

function topIssue(stages: StageMetric[]) {
    const worst = stages.reduce(
        (a, b) =>
            a.shuffleReadMB + a.shuffleWriteMB + a.spillMB + a.gcMs / 10 >
                b.shuffleReadMB + b.shuffleWriteMB + b.spillMB + b.gcMs / 10
                ? a
                : b,
        stages[0]
    );
    const shuffle = worst.shuffleReadMB + worst.shuffleWriteMB;
    if (shuffle > 250) return <Badge variant="outline">Shuffle</Badge>;
    if (worst.spillMB > 120) return <Badge variant="outline">Spill</Badge>;
    if (worst.skewScore > 0.6) return <Badge variant="outline">Skew</Badge>;
    return <Badge variant="outline">IO</Badge>;
}
