import { Snapshot } from "@/types";
import { useSimStore } from "@/store/useSimStore";
import { diffLines } from "@/lib/simulation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function PlanDiff({
    snap,
    baselineSnap,
}: {
    snap: Snapshot;
    baselineSnap: Snapshot | null;
}) {
    const compare = useSimStore((s) => s.compareBaseline);
    const before =
        compare && baselineSnap ? baselineSnap.plan.before : snap.plan.before;
    const after = compare && baselineSnap ? snap.plan.after : snap.plan.after;
    const lines = diffLines(before, after);

    return (
        <Card className="rounded-2xl h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Plan diff</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-2xl border overflow-hidden">
                    <ScrollArea className="h-64">
                        <pre className="text-xs p-3 leading-relaxed">
                            {lines.map((l, i) => (
                                <div
                                    key={i}
                                    className={
                                        l.kind === "add"
                                            ? "bg-muted/60"
                                            : l.kind === "del"
                                                ? "bg-destructive/10"
                                                : ""
                                    }
                                >
                                    <span className="text-muted-foreground mr-2">
                                        {l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}
                                    </span>
                                    <span>{l.text}</span>
                                </div>
                            ))}
                        </pre>
                    </ScrollArea>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                    {snap.plan.highlights.map((h) => (
                        <Badge key={h} variant="outline">
                            {h}
                        </Badge>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
