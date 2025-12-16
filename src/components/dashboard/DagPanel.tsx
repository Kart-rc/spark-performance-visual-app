import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { MissionId } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DagPanel({ missionId }: { missionId: MissionId }) {
    const dagNodes = useMemo(() => {
        if (missionId === "etl_joins") {
            return [
                { id: "n1", label: "Read Bronze (Delta)" },
                { id: "n2", label: "Clean + Dedup" },
                { id: "n3", label: "Join Orders ↔ Customers" },
                { id: "n4", label: "Aggregate" },
                { id: "n5", label: "Write Silver/Gold (Delta)" },
            ];
        }
        if (missionId === "cdc_merge") {
            return [
                { id: "n1", label: "Read CDC (Delta)" },
                { id: "n2", label: "Pre-dedup / Prep" },
                { id: "n3", label: "MERGE match" },
                { id: "n4", label: "Rewrite touched files" },
            ];
        }
        if (missionId === "skew_tail") {
            return [
                { id: "n1", label: "Read Delta" },
                { id: "n2", label: "Join (hot key)" },
                { id: "n3", label: "Aggregate (tail)" },
                { id: "n4", label: "Write Delta" },
            ];
        }
        if (missionId === "cache_spill") {
            return [
                { id: "c1", label: "Read Raw" },
                { id: "c2", label: "Clean & Cache" },
                { id: "c3", label: "Join (Reuse)" },
                { id: "c4", label: "Agg (Reuse)" },
            ];
        }
        if (missionId === "dpp_tuning") {
            return [
                { id: "d1", label: "Read Fact (Partitioned)" },
                { id: "d2", label: "Read Dim + Filter" },
                { id: "d3", label: "Join (DPP check)" },
                { id: "d4", label: "Write Result" },
            ];
        }
        if (missionId === "udf_native") {
            return [
                { id: "u1", label: "Read Data" },
                { id: "u2", label: "Agg (UDF/Native)" },
                { id: "u3", label: "Write Result" },
            ];
        }
        if (missionId === "wide_schema") {
            return [
                { id: "w1", label: "Scan (Wide/Narrow)" },
                { id: "w2", label: "Exchange & Sort" },
                { id: "w3", label: "Write Result" },
            ];
        }
        if (missionId === "multi_join") {
            return [
                { id: "m1", label: "Read Tables" },
                { id: "m2", label: "Join A+B" },
                { id: "m3", label: "Join +C+D+E" },
            ];
        }
        return [
            { id: "n1", label: "Read Delta (many files)" },
            { id: "n2", label: "Filter / Project" },
            { id: "n3", label: "Simple transform" },
            { id: "n4", label: "Write Delta" },
        ];
    }, [missionId]);

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Pipeline DAG</CardTitle>
                    <Badge variant="outline">Locked graph</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                    {dagNodes.map((n, idx) => (
                        <React.Fragment key={n.id}>
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: idx * 0.03 }}
                                className="px-3 py-2 rounded-2xl border bg-card shadow-sm text-sm"
                            >
                                {n.label}
                            </motion.div>
                            {idx < dagNodes.length - 1 && (
                                <span className="text-muted-foreground">→</span>
                            )}
                        </React.Fragment>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Tune behavior using the knobs below (no repartition). Observe how
                    metrics, plan, and data movement change.
                </p>
            </CardContent>
        </Card>
    );
}
