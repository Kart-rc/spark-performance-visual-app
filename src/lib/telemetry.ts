import { trace, SpanStatusCode, Span } from "@opentelemetry/api";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OtelSpan, OtelTrace } from "@/types/telemetry";

// Custom in-memory exporter for visualization
class InMemorySpanExporter {
    private spans: OtelSpan[] = [];

    export(spans: any[], resultCallback: (result: any) => void): void {
        spans.forEach((span) => {
            this.spans.push(this.convertSpan(span));
        });
        resultCallback({ code: 0 });
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

    private convertSpan(span: any): OtelSpan {
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
            parentSpanId: span.parentSpanId,
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

const provider = new WebTracerProvider();

// @ts-ignore - BatchSpanProcessor is compatible but types don't match exactly
provider.addSpanProcessor(new BatchSpanProcessor(spanExporter));
provider.register();

export const tracer = trace.getTracer("spark-simulation", "1.0.0");

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
