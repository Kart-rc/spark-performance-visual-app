import { useEffect, useState } from "react";
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType,
    BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { LineageGraph } from "@/types/telemetry";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Clock, Database, Shuffle, Filter, Cpu, ChevronDown, ChevronRight } from "lucide-react";

interface LineageGraphViewerProps {
    lineageGraph: LineageGraph;
}

type CustomNodeData = {
    label: string;
    type: string;
    durationMs?: number;
    shuffleReadMB?: number;
    shuffleWriteMB?: number;
    spillMB?: number;
    skewScore?: number;
    knobsAffecting?: string[];
    isCritical?: boolean;
    isStaticDoc?: boolean;
    description?: string;
    columns?: {
        name: string;
        type: string;
    }[];
};

const nodeTypeColors = {
    source: "#10b981", // green
    transformation: "#3b82f6", // blue
    join: "#f59e0b", // amber
    aggregate: "#8b5cf6", // purple
    filter: "#ec4899", // pink
    project: "#06b6d4", // cyan
    shuffle: "#f97316", // orange
    cache: "#14b8a6", // teal
    sink: "#ef4444", // red
};

const nodeTypeIcons = {
    source: Database,
    transformation: Cpu,
    join: GitBranch,
    aggregate: Cpu,
    filter: Filter,
    project: Cpu,
    shuffle: Shuffle,
    cache: Database,
    sink: Database,
};

function CustomNode({ data }: { data: CustomNodeData }) {
    const Icon = nodeTypeIcons[data.type as keyof typeof nodeTypeIcons] || Cpu;
    const color = nodeTypeColors[data.type as keyof typeof nodeTypeColors] || "#6b7280";
    const [showColumns, setShowColumns] = useState(false);

    return (
        <div
            className="px-4 py-3 rounded-lg border-2 bg-card shadow-lg min-w-[200px]"
            style={{ borderColor: color }}
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" style={{ color }} />
                <div className="font-semibold text-sm">{data.label}</div>
                {data.isStaticDoc && (
                    <Badge variant="outline" className="text-[10px] border-blue-400/50 bg-blue-500/10 text-blue-200">
                        SCA doc
                    </Badge>
                )}
            </div>

            <div className="text-xs space-y-1">
                {data.durationMs !== undefined && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-mono">{(data.durationMs / 1000).toFixed(2)}s</span>
                    </div>
                )}

                {data.shuffleReadMB !== undefined && data.shuffleReadMB > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Shuffle Read:</span>
                        <span className="font-mono">{data.shuffleReadMB.toFixed(0)} MB</span>
                    </div>
                )}

                {data.shuffleWriteMB !== undefined && data.shuffleWriteMB > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Shuffle Write:</span>
                        <span className="font-mono">{data.shuffleWriteMB.toFixed(0)} MB</span>
                    </div>
                )}

                {data.spillMB !== undefined && data.spillMB > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Spill:</span>
                        <span className="font-mono text-yellow-400">{data.spillMB.toFixed(0)} MB</span>
                    </div>
                )}

                {data.skewScore !== undefined && data.skewScore > 0.5 && (
                    <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Skew:</span>
                        <span className="font-mono text-orange-400">
                            {(data.skewScore * 100).toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            {data.columns && data.columns.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                    <div
                        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1"
                        onClick={() => setShowColumns(!showColumns)}
                    >
                        <span className="text-xs text-muted-foreground">Columns ({data.columns.length})</span>
                        {showColumns ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </div>

                    {showColumns && (
                        <div className="mt-1 space-y-1 bg-muted/30 p-1.5 rounded max-h-[120px] overflow-y-auto">
                            {data.columns.map((col, i) => (
                                <div key={i} className="flex items-center justify-between text-[10px]">
                                    <span className="font-medium truncate max-w-[100px]" title={col.name}>{col.name}</span>
                                    <span className="text-muted-foreground font-mono">{col.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {data.knobsAffecting && data.knobsAffecting.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-1">Affected by:</div>
                    <div className="flex flex-wrap gap-1">
                        {data.knobsAffecting.slice(0, 3).map((knob: string) => (
                            <Badge key={knob} variant="secondary" className="text-xs px-1 py-0">
                                {knob}
                            </Badge>
                        ))}
                        {data.knobsAffecting.length > 3 && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                                +{data.knobsAffecting.length - 3}
                            </Badge>
                        )}
                    </div>
                </div>
            )}

            {data.isCritical && (
                <div className="mt-2 pt-2 border-t border-border">
                    <Badge variant="destructive" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Critical Path
                    </Badge>
                </div>
            )}

            {data.description && (
                <div className="mt-2 pt-2 border-t border-border text-muted-foreground leading-snug">
                    {data.description}
                </div>
            )}
        </div>
    );
}

const nodeTypes = {
    custom: CustomNode,
};

export function LineageGraphViewer({ lineageGraph }: LineageGraphViewerProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Convert lineage graph to ReactFlow nodes and edges
    useEffect(() => {
        const flowNodes: Node[] = lineageGraph.nodes.map((node, index) => {
            const isCritical = lineageGraph.metadata.criticalPath.includes(node.id);

            return {
                id: node.id,
                type: "custom",
                position: { x: 100, y: index * 200 },
                data: {
                    label: node.name,
                    type: node.type,
                    durationMs: node.metrics.durationMs,
                    shuffleReadMB: node.metrics.shuffleReadMB,
                    shuffleWriteMB: node.metrics.shuffleWriteMB,
                    spillMB: node.metrics.spillMB,
                    skewScore: node.metrics.skewScore,
                    knobsAffecting: node.knobsAffecting,
                    isCritical,
                    isStaticDoc: Boolean(node.attributes?.staticDoc),
                    description: node.attributes?.description,
                    columns: node.columns,
                },
            };
        });

        const flowEdges: Edge[] = lineageGraph.edges.map((edge) => {
            const edgeColor =
                edge.type === "shuffle"
                    ? "#f97316"
                    : edge.type === "broadcast"
                      ? "#14b8a6"
                      : "#6b7280";

            return {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label,
                type: "smoothstep",
                animated: edge.type === "shuffle",
                style: { stroke: edgeColor, strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: edgeColor,
                },
                labelStyle: {
                    fontSize: 10,
                    fontWeight: 500,
                },
                labelBgStyle: {
                    fill: "hsl(var(--background))",
                },
            };
        });

        setNodes(flowNodes);
        setEdges(flowEdges);
    }, [lineageGraph, setNodes, setEdges]);

    // Auto-layout using a simple top-to-bottom layout
    useEffect(() => {
        setNodes((currentNodes) =>
            currentNodes.length > 0
                ? currentNodes.map((node, index) => ({
                      ...node,
                      position: {
                          x: 300,
                          y: index * 220 + 50,
                      },
                  }))
                : currentNodes
        );
    }, [lineageGraph.nodes.length, setNodes]); // Only re-layout when number of nodes changes

    return (
        <Card className="p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">React App Lineage</h3>
                    <Badge variant="secondary">{lineageGraph.nodes.length} actions</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-gray-500" />
                        <span>Action flow</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 rounded border bg-muted/20">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    attributionPosition="bottom-left"
                >
                    <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                    <Controls />
                </ReactFlow>
            </div>

            <div className="mt-3 p-3 bg-muted/50 rounded text-xs">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <span className="text-muted-foreground">Total Duration:</span>
                        <div className="font-mono font-semibold">
                            {(lineageGraph.metadata.totalDurationMs / 1000).toFixed(2)}s
                        </div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Critical Path Actions:</span>
                        <div className="font-mono font-semibold">
                            {lineageGraph.metadata.criticalPath.length}
                        </div>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Generated:</span>
                        <div className="font-mono">
                            {new Date(lineageGraph.metadata.generatedAt).toLocaleTimeString()}
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
}
