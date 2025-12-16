import { Knobs, MissionId, Snapshot } from "@/types";

export type ChatMessage = {
    role: "user" | "model";
    text: string;
};

export const SUGGESTED_QUESTIONS = [
    "Analyze my run",
    "Explain the plan",
    "How do I fix the spill?",
    "What is AQE?",
];

export function analyzeSnapshot(snap: Snapshot, missionId: MissionId): string[] {
    const observations: string[] = [];

    // Check for spill
    const spillStage = snap.stages.find((s) => s.spillMB > 0);
    if (spillStage) {
        observations.push(
            `I detected ${spillStage.spillMB}MB of spill in the "${spillStage.name}" stage. This usually means data is too large for memory.`
        );
    }

    // Check for skew
    const skewStage = snap.stages.find((s) => s.skewScore > 0.5);
    if (skewStage) {
        observations.push(
            `High skew detected in "${skewStage.name}". Some tasks are taking much longer than others.`
        );
    }

    // Check for high shuffle
    const shuffleStage = snap.stages.find((s) => s.shuffleWriteMB > 1000);
    if (shuffleStage) {
        observations.push(
            `"${shuffleStage.name}" is writing a lot of shuffle data (${shuffleStage.shuffleWriteMB}MB). Consider filtering earlier.`
        );
    }

    // Mission specific checks
    if (missionId === "udf_native") {
        const cpuStage = snap.stages.find((s) => s.durationMs > 20000);
        if (cpuStage) {
            observations.push(
                `The "${cpuStage.name}" stage is very slow despite low I/O. This suggests a CPU bottleneck, likely due to the Python UDF.`
            );
        }
    }

    if (observations.length === 0) {
        observations.push(
            "The run looks healthy! No major spill or skew detected. Great job!"
        );
    }

    return observations;
}

export function explainPlanDiff(missionId: MissionId, knobs: Knobs): string {
    if (missionId === "etl_joins") {
        if (knobs.broadcastCustomers) {
            return "By enabling Broadcast, Spark sends the small 'Customers' table to all executors. This avoids shuffling the massive 'Orders' table, converting a SortMergeJoin into a BroadcastHashJoin.";
        }
        return "Currently using a SortMergeJoin. Both tables are being shuffled and sorted by join key. This is robust but expensive for large data.";
    }

    if (missionId === "udf_native") {
        if (!knobs.useUdf) {
            return "Switching to native functions allowed Catalyst to use Whole-Stage Codegen. The 'BatchEvalPython' node is gone, replaced by optimized JVM bytecode.";
        }
        return "The plan shows 'BatchEvalPython'. Spark has to serialize data from JVM to Python worker and back for every row. This prevents many optimizations.";
    }

    if (missionId === "multi_join") {
        if (knobs.optimizeJoinOrder) {
            return "AQE/CBO reordered the joins. Instead of joining two big tables first, it joined a small table early, reducing the intermediate data size.";
        }
        return "The join order follows the code (A join B join C). Since A and B are big, the first join produces a massive intermediate result.";
    }

    return "The plan reflects your current configuration. Compare the 'Before' and 'After' trees to see how knobs affect the physical execution.";
}

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function getGeminiResponse(
    query: string,
    context: { missionId: MissionId; snap: Snapshot; knobs: Knobs }
): Promise<string> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    // Fallback to mock if no key
    if (!apiKey || apiKey === "your_api_key_here") {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return getMockResponse(query, context);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
You are an expert Spark performance tuning assistant.
Context:
Mission: ${context.missionId}
Knobs: ${JSON.stringify(context.knobs, null, 2)}
Snapshot Stats: ${JSON.stringify(
            context.snap.stages.map((s) => ({
                name: s.name,
                duration: s.durationMs,
                shuffle: s.shuffleWriteMB,
                spill: s.spillMB,
                skew: s.skewScore,
            })),
            null,
            2
        )}

User Question: ${query}

Provide a helpful, concise answer based on the context. Focus on Spark performance concepts.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error Details:", error);
        return "I'm having trouble connecting to my brain (API Error). Falling back to local knowledge.\n\n" + getMockResponse(query, context);
    }
}

function getMockResponse(query: string, context: { missionId: MissionId; snap: Snapshot; knobs: Knobs }): string {
    const q = query.toLowerCase();

    if (q.includes("analyze") || q.includes("run")) {
        const obs = analyzeSnapshot(context.snap, context.missionId);
        return `(Mock) Here's what I found in your latest run:\n\n${obs
            .map((o) => "- " + o)
            .join("\n")}`;
    }

    if (q.includes("plan") || q.includes("explain")) {
        return "(Mock) " + explainPlanDiff(context.missionId, context.knobs);
    }

    if (q.includes("aqe")) {
        return "(Mock) Adaptive Query Execution (AQE) allows Spark to re-optimize the query plan at runtime based on actual statistics. It can coalesce partitions, handle skew, and switch join strategies dynamically.";
    }

    if (q.includes("spill")) {
        return "(Mock) Spill happens when a task's memory usage exceeds its allocated RAM. Spark writes the excess data to disk, which is very slow. You can fix it by increasing partitions, fixing skew, or reducing data size (filtering).";
    }

    if (q.includes("skew")) {
        return "(Mock) Data skew occurs when one partition has significantly more data than others. This causes one task to run much longer, holding up the entire stage. AQE or salt keys can help.";
    }

    return "(Mock) That's a great question! I'm tuned to help with Spark performance. Try asking about the 'plan', 'spill', 'skew', or ask me to 'analyze' your run.";
}
