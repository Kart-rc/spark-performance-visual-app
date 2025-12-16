import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { MissionId, Snapshot } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function clamp(n: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, n));
}

function fileMetricLabel(missionId: MissionId) {
    return missionId === "cdc_merge" ? "Files touched" : "Files scanned";
}

function filesTitle(missionId: MissionId) {
    return missionId === "cdc_merge"
        ? "Delta files touched"
        : "Delta file overhead";
}

export function PartitionOrFileAnim({
    snap,
    missionId,
}: {
    snap: Snapshot;
    missionId: MissionId;
}) {
    const mode = snap.animation.meta.mode;

    return (
        <Card className="rounded-2xl h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">
                    {mode === "shuffle" ? "Partition movement" : filesTitle(missionId)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                {mode === "shuffle" ? (
                    <ShuffleAnim snap={snap} />
                ) : (
                    <FilesAnim snap={snap} missionId={missionId} />
                )}

                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">
                    {mode === "shuffle" ? (
                        <p>
                            Bigger tiles = more data. "spill" flags appear when memory
                            pressure forces disk usage. Skew shows as one oversized partition.
                        </p>
                    ) : (
                        <p>
                            Highlighted files are the ones your query/merge impacts. Goal:
                            reduce the hot set using OPTIMIZE/ZORDER and pushdown-friendly
                            predicates.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ShuffleAnim({ snap }: { snap: Snapshot }) {
    const { partitions, meta } = snap.animation;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Badge variant="outline">
                    Shuffle intensity: {Math.round(meta.shuffleIntensity * 100)}%
                </Badge>
                <Badge variant="outline">
                    Spill: {Math.round(meta.spillIntensity * 100)}%
                </Badge>
            </div>

            <div className="grid grid-cols-6 gap-2">
                {partitions.map((p) => (
                    <motion.div
                        key={p.id}
                        className="rounded-xl border bg-card shadow-sm relative overflow-hidden"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className="absolute inset-0"
                            animate={{ y: [6, -6, 6] }}
                            transition={{
                                duration: 2.4,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />

                        <div className="p-2">
                            <div className="text-[10px] text-muted-foreground">p{p.id}</div>
                            <div className="mt-1 flex items-end gap-1">
                                <div
                                    className="rounded-md w-2"
                                    style={{ height: clamp(p.size * 2.2, 10, 70) }}
                                />
                                <div className="text-xs font-semibold">{p.size}</div>
                            </div>
                            {p.spilled && (
                                <div className="mt-2">
                                    <Badge variant="outline">spill</Badge>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function FilesAnim({
    snap,
    missionId,
}: {
    snap: Snapshot;
    missionId: MissionId;
}) {
    const { files, meta } = snap.animation;
    const pct = meta.fileImpactPct ?? 0;
    const count = meta.fileCount ?? files.length;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Badge variant="outline">
                    {fileMetricLabel(missionId)}: {pct}%
                </Badge>
                <Badge variant="outline">Files: {count}</Badge>
            </div>

            <div className="grid grid-cols-6 gap-2">
                {files.map((f) => (
                    <motion.div
                        key={f.id}
                        className="rounded-xl border bg-card shadow-sm p-2"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="text-[10px] text-muted-foreground">file{f.id}</div>
                        <div className="text-xs font-semibold mt-1">{f.sizeMB}MB</div>
                        <div className="mt-2">
                            <Badge variant={f.hot ? "destructive" : "outline"}>
                                {f.hot ? "hot" : "skip"}
                            </Badge>
                        </div>
                    </motion.div>
                ))}
            </div>

            {missionId === "small_files" && (
                <div className="p-2 rounded-xl border text-xs text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5" />
                    <div>
                        Small files usually show up as overhead in listing/opening, not as
                        big shuffles.
                    </div>
                </div>
            )}
        </div>
    );
}
