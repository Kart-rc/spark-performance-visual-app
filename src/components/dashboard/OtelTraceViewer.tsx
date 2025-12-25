import { useEffect, useState } from "react";
import { getTraces, clearTraces } from "@/lib/telemetry";
import { OtelTrace, OtelSpan } from "@/types/telemetry";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Activity,
    Clock,
    Zap,
    Trash2,
    ChevronDown,
    ChevronRight,
    Layers,
} from "lucide-react";

export function OtelTraceViewer() {
    const [traces, setTraces] = useState<OtelTrace[]>([]);
    const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
    const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
    const [groupBy, setGroupBy] = useState<"name" | "status">("name");

    useEffect(() => {
        const interval = setInterval(() => {
            setTraces(getTraces());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const handleClearTraces = () => {
        clearTraces();
        setTraces([]);
        setSelectedTraceId(null);
    };

    const toggleSpan = (spanId: string) => {
        setExpandedSpans((prev) => {
            const next = new Set(prev);
            if (next.has(spanId)) {
                next.delete(spanId);
            } else {
                next.add(spanId);
            }
            return next;
        });
    };

    const formatDuration = (ms: number) => {
        if (ms < 1) return `${(ms * 1000).toFixed(2)}µs`;
        if (ms < 1000) return `${ms.toFixed(2)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "ok":
                return "bg-green-500/20 text-green-300 border-green-500/50";
            case "error":
                return "bg-red-500/20 text-red-300 border-red-500/50";
            default:
                return "bg-gray-500/20 text-gray-300 border-gray-500/50";
        }
    };

    const groupedTraces = traces.reduce<Record<string, OtelTrace[]>>((acc, trace) => {
        let key = "Unknown";
        if (groupBy === "name") {
            key = trace.rootSpan?.name || "Unknown flow";
        } else if (groupBy === "status") {
            key = trace.rootSpan?.status || "unset";
        }

        if (!acc[key]) acc[key] = [];
        acc[key].push(trace);
        return acc;
    }, {});

    const selectedTrace =
        traces.find((trace) => trace.traceId === selectedTraceId) || traces[0] || null;

    const renderTraceTimeline = (trace: OtelTrace) => {
        const traceStart = trace.startTime;
        const traceWidth = trace.duration || 1;

        // Calculate visual rows to avoid overlap
        const spansWithRows = trace.spans
            .sort((a, b) => a.startTime - b.startTime)
            .map((span) => ({ ...span, row: 0 }));

        // Simple improved packing algorithm
        for (let i = 0; i < spansWithRows.length; i++) {
            const current = spansWithRows[i];
            // Check for overlaps with previous spans in the same row
            let row = 0;
            while (true) {
                let overlap = false;
                for (let j = 0; j < i; j++) {
                    const prev = spansWithRows[j];
                    if (prev.row === row) {
                        // Check if time intervals overlap
                        if (current.startTime < prev.endTime && current.endTime > prev.startTime) {
                            overlap = true;
                            break;
                        }
                    }
                }
                if (!overlap) {
                    current.row = row;
                    break;
                }
                row++;
            }
        }

        const maxRow = Math.max(...spansWithRows.map(s => s.row));
        const rowHeight = 24;
        const totalHeight = (maxRow + 1) * rowHeight + 10;

        return (
            <div className="mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Trace timeline</span>
                    <span className="font-mono text-foreground">{formatDuration(trace.duration)}</span>
                </div>
                <div
                    className="relative bg-muted/40 rounded overflow-hidden border border-border/60"
                    style={{ height: `${totalHeight}px` }}
                >
                    {spansWithRows.map((span) => {
                            const spanStart = span.startTime - traceStart;
                            const leftPct = (spanStart / traceWidth) * 100;
                            const widthPct = Math.max((span.duration / traceWidth) * 100, 0.5);
                            return (
                                <div
                                    key={span.spanId}
                                    className="absolute h-5 rounded text-[10px] flex items-center px-1 truncate select-none hover:ring-1 ring-ring"
                                    style={{
                                        left: `${leftPct}%`,
                                        width: `${widthPct}%`,
                                        top: `${span.row * rowHeight + 5}px`,
                                        backgroundColor: span.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                        borderLeft: `2px solid ${span.status === 'error' ? '#ef4444' : '#3b82f6'}`,
                                        zIndex: 10
                                    }}
                                    title={`${span.name} • ${formatDuration(span.duration)}`}
                                >
                                    {span.name}
                                </div>
                            );
                        })}
                </div>
            </div>
        );
    };

    const renderSpanTree = (span: OtelSpan, trace: OtelTrace, level: number = 0) => {
        const children = trace.spans.filter((s) => s.parentSpanId === span.spanId);
        const isExpanded = expandedSpans.has(span.spanId);
        const hasChildren = children.length > 0;

        // Calculate span position and width relative to trace
        const traceStart = trace.startTime;
        const traceWidth = trace.duration;
        const spanStart = span.startTime - traceStart;
        const spanWidthPct = (span.duration / traceWidth) * 100;
        const spanLeftPct = (spanStart / traceWidth) * 100;

        return (
            <div key={span.spanId} className="mb-2">
                <div
                    className="flex items-start gap-2 hover:bg-muted/50 p-2 rounded cursor-pointer"
                    onClick={() => toggleSpan(span.spanId)}
                    style={{ paddingLeft: `${level * 24}px` }}
                >
                    <div className="flex-shrink-0 mt-1">
                        {hasChildren ? (
                            isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )
                        ) : (
                            <div className="h-4 w-4" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{span.name}</span>
                            <Badge variant="outline" className={getStatusColor(span.status)}>
                                {span.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground ml-auto">
                                {formatDuration(span.duration)}
                            </span>
                        </div>

                        {/* Span timeline bar */}
                        <div className="relative h-6 bg-muted/30 rounded overflow-hidden mb-1">
                            <div
                                className="absolute h-full bg-blue-500/60 hover:bg-blue-500/80 transition-colors"
                                style={{
                                    left: `${spanLeftPct}%`,
                                    width: `${spanWidthPct}%`,
                                }}
                                title={`${formatDuration(span.duration)} (${spanLeftPct.toFixed(1)}% - ${(spanLeftPct + spanWidthPct).toFixed(1)}%)`}
                            />
                        </div>

                        {isExpanded && (
                            <div className="mt-2 space-y-2 text-xs">
                                {/* Attributes */}
                                {Object.keys(span.attributes).length > 0 && (
                                    <div>
                                        <div className="font-semibold mb-1">Attributes:</div>
                                        <div className="bg-muted/50 p-2 rounded space-y-1">
                                            {Object.entries(span.attributes).map(([key, value]) => (
                                                <div key={key} className="flex gap-2">
                                                    <span className="text-muted-foreground">{key}:</span>
                                                    <span className="font-mono">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Events */}
                                {span.events.length > 0 && (
                                    <div>
                                        <div className="font-semibold mb-1">Events:</div>
                                        <div className="bg-muted/50 p-2 rounded space-y-1">
                                            {span.events.map((event, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <Zap className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                                    <span>{event.name}</span>
                                                    <span className="text-muted-foreground text-xs ml-auto">
                                                        {new Date(event.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Render children */}
                {isExpanded && children.map((child) => renderSpanTree(child, trace, level + 1))}
            </div>
        );
    };

    return (
        <Card className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">OpenTelemetry Traces</h3>
                    <Badge variant="secondary">{traces.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-muted rounded p-1 text-xs">
                        <span className="px-1 text-muted-foreground">Group by:</span>
                        <button
                            className={`px-2 py-0.5 rounded ${groupBy === 'name' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                            onClick={() => setGroupBy("name")}
                        >
                            Name
                        </button>
                        <button
                            className={`px-2 py-0.5 rounded ${groupBy === 'status' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                            onClick={() => setGroupBy("status")}
                        >
                            Status
                        </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearTraces}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                    </Button>
                </div>
            </div>

            {traces.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No traces captured yet</p>
                        <p className="text-xs">Interact with the React app to generate traces</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex gap-4 min-h-0">
                    {/* Trace list */}
                    <div className="w-72 flex-shrink-0">
                        <ScrollArea className="h-full">
                            {Object.entries(groupedTraces)
                                .sort((a, b) => b[1].length - a[1].length)
                                .map(([name, grouped]) => (
                                    <div key={name} className="mb-3">
                                        <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                                            <Layers className="h-3 w-3" />
                                            <span>{name}</span>
                                            <Badge variant="secondary" className="ml-auto">
                                                {grouped.length} traces
                                            </Badge>
                                        </div>
                                        {grouped
                                            .sort((a, b) => b.startTime - a.startTime)
                                            .map((trace) => (
                                                <Card
                                                    key={trace.traceId}
                                                    className={`p-3 mb-2 cursor-pointer transition-colors ${
                                                        selectedTrace?.traceId === trace.traceId
                                                            ? "border-primary bg-muted/50"
                                                            : "hover:bg-muted/30"
                                                    }`}
                                                    onClick={() => setSelectedTraceId(trace.traceId)}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(trace.startTime).toLocaleTimeString()}
                                                        </span>
                                                        <Badge
                                                            variant="outline"
                                                            className={getStatusColor(trace.rootSpan.status)}
                                                        >
                                                            {trace.rootSpan.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm font-medium truncate mb-1">
                                                        {trace.rootSpan.name}
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-muted-foreground">
                                                            {trace.spans.length} spans
                                                        </span>
                                                        <span className="font-mono">
                                                            {formatDuration(trace.duration)}
                                                        </span>
                                                    </div>
                                                </Card>
                                            ))}
                                    </div>
                                ))}
                        </ScrollArea>
                    </div>

                    {/* Trace details */}
                    <div className="flex-1 min-w-0">
                        {selectedTrace ? (
                            <ScrollArea className="h-full">
                                <div className="space-y-3">
                                    <div className="bg-muted/50 p-3 rounded space-y-2">
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Trace ID:</span>
                                                <div className="font-mono text-xs truncate">
                                                    {selectedTrace.traceId}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Duration:</span>
                                                <div className="font-mono">
                                                    {formatDuration(selectedTrace.duration)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div className="bg-background/80 p-2 rounded border border-border/60">
                                                <div className="text-muted-foreground">Spans</div>
                                                <div className="font-mono text-sm font-semibold">
                                                    {selectedTrace.spans.length}
                                                </div>
                                            </div>
                                            <div className="bg-background/80 p-2 rounded border border-border/60">
                                                <div className="text-muted-foreground">Root span</div>
                                                <div className="font-mono text-[11px] truncate">
                                                    {selectedTrace.rootSpan.name}
                                                </div>
                                            </div>
                                            <div className="bg-background/80 p-2 rounded border border-border/60">
                                                <div className="text-muted-foreground">Start</div>
                                                <div className="font-mono text-[11px] truncate">
                                                    {new Date(selectedTrace.startTime).toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                        {renderTraceTimeline(selectedTrace)}
                                    </div>

                                    {/* Render root spans and their children */}
                                    {selectedTrace.spans
                                        .filter((s) => !s.parentSpanId)
                                        .map((span) => renderSpanTree(span, selectedTrace))}
                                </div>
                            </ScrollArea>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                Select a trace to view details
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}
