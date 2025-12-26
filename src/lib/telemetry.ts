import { trace, SpanStatusCode, Span } from "@opentelemetry/api";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import {
    ReadableSpan,
    SpanExporter,
    SimpleSpanProcessor,
    BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { ExportResultCode } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OtelSpan, OtelTrace } from "@/types/telemetry";

// Custom in-memory exporter for visualization
class InMemorySpanExporter implements SpanExporter {
    private spans: OtelSpan[] = [];

    export(
        spans: ReadableSpan[],
        resultCallback: (result: { code: ExportResultCode; error?: Error }) => void
    ): void {
        spans.forEach((span) => {
            this.spans.push(this.convertSpan(span));
        });
        resultCallback({ code: ExportResultCode.SUCCESS });
    }

    shutdown(): Promise<void> {
        return Promise.resolve();
    }

    getSpans(): OtelSpan[] {
        return [...this.spans];
    }

    clearSpans(): void {
        this.spans = [];
    }

    private convertSpan(span: ReadableSpan): OtelSpan {
        const attributes: Record<string, string | number | boolean> = {};
        if (span.attributes) {
            Object.entries(span.attributes).forEach(([key, value]) => {
                attributes[key] = value as string | number | boolean;
            });
        }

        const events = span.events?.map((event: any) => ({
            name: event.name,
            timestamp: event.time?.[0] * 1000 + event.time?.[1] / 1000000 || Date.now(),
            attributes: event.attributes || {},
        })) || [];

        const startTime = span.startTime[0] * 1000 + span.startTime[1] / 1000000;
        const endTime = span.endTime[0] * 1000 + span.endTime[1] / 1000000;

        return {
            spanId: span.spanContext().spanId,
            traceId: span.spanContext().traceId,
            parentSpanId: span.parentSpanContext?.spanId,
            name: span.name,
            startTime,
            endTime,
            duration: endTime - startTime,
            status: span.status.code === SpanStatusCode.OK ? "ok" :
                    span.status.code === SpanStatusCode.ERROR ? "error" : "unset",
            attributes,
            events,
        };
    }
}

// Initialize OpenTelemetry
export const spanExporter = new InMemorySpanExporter();

// Configuration from environment variables
const OTLP_ENDPOINT = import.meta.env.VITE_OTLP_ENDPOINT || "http://localhost:4318/v1/traces";
const ENABLE_OTLP = import.meta.env.VITE_ENABLE_OTLP === "true";

// Build span processors array
const spanProcessors: (SimpleSpanProcessor | BatchSpanProcessor)[] = [
    new SimpleSpanProcessor(spanExporter), // In-memory for UI
];

// Add OTLP exporter for Grafana/Tempo if enabled
if (ENABLE_OTLP) {
    try {
        const otlpExporter = new OTLPTraceExporter({
            url: OTLP_ENDPOINT,
            headers: {
                "Content-Type": "application/json",
            },
        });
        spanProcessors.push(new BatchSpanProcessor(otlpExporter));
        console.log(`✅ OTLP exporter configured: ${OTLP_ENDPOINT}`);
    } catch (error) {
        console.error("❌ Failed to configure OTLP exporter:", error);
    }
}

// Create provider with span processors
const provider = new WebTracerProvider({
    spanProcessors,
});

provider.register();

export const tracer = trace.getTracer("spark-performance-react-app", "1.0.0");

// Helper to get all traces grouped by traceId
export function getTraces(): OtelTrace[] {
    const spans = spanExporter.getSpans();
    const traceMap = new Map<string, OtelSpan[]>();

    spans.forEach((span) => {
        if (!traceMap.has(span.traceId)) {
            traceMap.set(span.traceId, []);
        }
        traceMap.get(span.traceId)!.push(span);
    });

    const traces: OtelTrace[] = [];
    traceMap.forEach((spans, traceId) => {
        const sortedSpans = spans.sort((a, b) => a.startTime - b.startTime);
        const rootSpan = sortedSpans.find((s) => !s.parentSpanId) || sortedSpans[0];
        const startTime = Math.min(...spans.map((s) => s.startTime));
        const endTime = Math.max(...spans.map((s) => s.endTime));

        traces.push({
            traceId,
            spans: sortedSpans,
            startTime,
            endTime,
            duration: endTime - startTime,
            rootSpan,
        });
    });

    return traces.sort((a, b) => b.startTime - a.startTime);
}

export function clearTraces(): void {
    spanExporter.clearSpans();
}

// Wrapper function to instrument async operations
export async function withSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    fn: (span: Span) => Promise<T> | T
): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
        try {
            Object.entries(attributes).forEach(([key, value]) => {
                span.setAttribute(key, value);
            });
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error),
            });
            span.recordException(error as Error);
            throw error;
        } finally {
            span.end();
        }
    });
}

// Synchronous span wrapper
export function withSyncSpan<T>(
    name: string,
    attributes: Record<string, string | number | boolean>,
    fn: (span: Span) => T
): T {
    const span = tracer.startSpan(name);
    try {
        Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
        });
        const result = fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
    } catch (error) {
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error as Error);
        throw error;
    } finally {
        span.end();
    }
}
