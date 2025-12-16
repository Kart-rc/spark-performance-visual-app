import { MissionId } from "@/types";
import { useSimStore } from "@/store/useSimStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

export function KnobPanel({ missionId }: { missionId: MissionId }) {
    const knobs = useSimStore((s) => s.knobs)!;
    const setKnob = useSimStore((s) => s.setKnob);

    const isJoinMission = missionId === "etl_joins" || missionId === "skew_tail";
    const isDeltaLayoutMission =
        missionId === "cdc_merge" || missionId === "small_files";

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Control Panel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Section title="Query patterns (safe defaults)">
                    <ToggleRow
                        label="Project Early"
                        value={knobs.projectEarly}
                        onChange={(v) => setKnob("projectEarly", v)}
                        hint="Reduce bytes read & shuffled"
                    />
                    <ToggleRow
                        label="Filter Early"
                        value={knobs.filterEarly}
                        onChange={(v) => setKnob("filterEarly", v)}
                        hint="Shrink data before hotspots"
                    />
                </Section>

                <Section title="Execution">
                    <ToggleRow
                        label="AQE"
                        value={knobs.aqe}
                        onChange={(v) => setKnob("aqe", v)}
                        hint="Coalesce partitions; mitigate skew"
                    />
                    <ToggleRow
                        label="Dynamic Pruning"
                        value={knobs.dynamicPruning}
                        onChange={(v) => setKnob("dynamicPruning", v)}
                        hint="Reduce scans when predicates align"
                    />
                </Section>

                {isJoinMission && (
                    <Section title="Joins">
                        <ToggleRow
                            label="Broadcast Customers"
                            value={knobs.broadcastCustomers}
                            onChange={(v) => setKnob("broadcastCustomers", v)}
                            hint="Avoid shuffling the big side"
                        />
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-sm">Broadcast threshold (MB)</div>
                                <Badge variant="outline">{knobs.broadcastThresholdMB} MB</Badge>
                            </div>
                            <Slider
                                value={[knobs.broadcastThresholdMB]}
                                min={1}
                                max={64}
                                step={1}
                                onValueChange={(v) => setKnob("broadcastThresholdMB", v[0])}
                            />
                            <p className="text-xs text-muted-foreground">
                                If threshold is too low, broadcast may not apply even if enabled.
                            </p>
                        </div>
                    </Section>
                )}

                {(isJoinMission ||
                    missionId === "small_files" ||
                    missionId === "cache_spill") && (
                        <Section title="Caching">
                            <ToggleRow
                                label={
                                    missionId === "small_files"
                                        ? "Cache intermediate (usually not helpful)"
                                        : "Cache After Clean"
                                }
                                value={knobs.cacheAfterClean}
                                onChange={(v) => setKnob("cacheAfterClean", v)}
                                hint={
                                    missionId === "small_files"
                                        ? "Shows why caching doesn't solve small-file overhead"
                                        : missionId === "cache_spill"
                                            ? "Warning: Caching large datasets can cause spill"
                                            : "Can help or hurt depending on pressure"
                                }
                            />
                        </Section>
                    )}

                {missionId === "udf_native" && (
                    <Section title="Code Optimization">
                        <ToggleRow
                            label="Use Python UDF"
                            value={knobs.useUdf}
                            onChange={(v) => setKnob("useUdf", v)}
                            hint="Python serialization overhead vs Native codegen"
                        />
                    </Section>
                )}

                {missionId === "multi_join" && (
                    <Section title="Join Strategy">
                        <ToggleRow
                            label="Optimize Join Order"
                            value={knobs.optimizeJoinOrder}
                            onChange={(v) => setKnob("optimizeJoinOrder", v)}
                            hint="Reorder joins to minimize intermediate size"
                        />
                        <ToggleRow
                            label="Broadcast Small Tables"
                            value={knobs.broadcastCustomers}
                            onChange={(v) => setKnob("broadcastCustomers", v)}
                            hint="Avoid shuffling large tables"
                        />
                    </Section>
                )}

                {isDeltaLayoutMission && (
                    <>
                        <Section title="Delta layout">
                            <ToggleRow
                                label="OPTIMIZE"
                                value={knobs.optimizeBeforeMerge}
                                onChange={(v) => setKnob("optimizeBeforeMerge", v)}
                                hint="Compact small files"
                            />
                            <ToggleRow
                                label="ZORDER on keys"
                                value={knobs.zOrderOnKeys}
                                onChange={(v) => setKnob("zOrderOnKeys", v)}
                                hint="Improve skipping for selective reads"
                            />
                        </Section>

                        {missionId === "cdc_merge" && (
                            <Section title="MERGE patterns">
                                <ToggleRow
                                    label="Pre-dedup CDC"
                                    value={knobs.preDedupCdc}
                                    onChange={(v) => setKnob("preDedupCdc", v)}
                                    hint="Latest per key → less shuffle"
                                />
                                <ToggleRow
                                    label="Update only changed cols"
                                    value={knobs.updateOnlyChangedCols}
                                    onChange={(v) => setKnob("updateOnlyChangedCols", v)}
                                    hint="Lower rewrite amplification"
                                />
                            </Section>
                        )}
                    </>
                )}

                <Separator />
                <p className="text-xs text-muted-foreground">
                    Repartition/coalesce knobs intentionally omitted. This simulator
                    teaches levers you can still use.
                </p>
            </CardContent>
        </Card>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {title}
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function ToggleRow({
    label,
    value,
    onChange,
    hint,
}: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    hint?: string;
}) {
    return (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border">
            <div className="min-w-0">
                <div className="text-sm font-medium truncate">{label}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <Switch checked={value} onCheckedChange={onChange} />
        </div>
    );
}
