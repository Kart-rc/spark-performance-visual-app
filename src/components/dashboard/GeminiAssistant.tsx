import { useEffect, useRef } from "react";
import { Sparkles, Send, Bot, User } from "lucide-react";
import { useSimStore } from "@/store/useSimStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { SUGGESTED_QUESTIONS } from "@/lib/gemini";
import { missions } from "@/data/missions";
import { cn } from "@/lib/utils";

export function GeminiAssistant() {
    const history = useSimStore((s) => s.chatHistory);
    const isTyping = useSimStore((s) => s.isTyping);
    const send = useSimStore((s) => s.sendGeminiMessage);

    // Guide State
    const guideMode = useSimStore((s) => s.guideMode);
    const currentStep = useSimStore((s) => s.currentStep);
    const startGuide = useSimStore((s) => s.startGuide);
    const nextStep = useSimStore((s) => s.nextStep);
    const prevStep = useSimStore((s) => s.prevStep);
    const applyStep = useSimStore((s) => s.applyStep);
    const missionId = useSimStore((s) => s.missionId);
    const knobs = useSimStore((s) => s.knobs);
    const snap = useSimStore((s) => s.snapshot);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, isTyping, guideMode, currentStep]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (inputRef.current?.value) {
            send(inputRef.current.value);
            inputRef.current.value = "";
        }
    };

    // Guide Logic
    const steps = missionId ? missions[missionId]?.coachSteps || [] : [];
    const step = steps[currentStep];
    const isStepDone = step ? step.success(snap, knobs) : false;
    const isMissionComplete = currentStep >= steps.length;

    return (
        <Card className="w-full h-[600px] flex flex-col border-indigo-200 dark:border-indigo-800 shadow-sm">
            <CardHeader className="bg-indigo-50 dark:bg-indigo-950/30 rounded-t-xl border-b p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                    <CardTitle className="text-base text-indigo-900 dark:text-indigo-100">
                        {guideMode ? "Gemini Guide" : "Gemini Co-pilot"}
                    </CardTitle>
                </div>
                {!guideMode && missionId && (
                    <Button size="sm" variant="outline" onClick={startGuide} className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                        Start Guide
                    </Button>
                )}
            </CardHeader>

            <div className="flex-1 overflow-hidden relative flex flex-col">
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                    {history.map((msg, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "flex gap-3 max-w-[90%]",
                                msg.role === "user" ? "ml-auto flex-row-reverse" : ""
                            )}
                        >
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                    msg.role === "model"
                                        ? "bg-indigo-100 text-indigo-600"
                                        : "bg-slate-100 text-slate-600"
                                )}
                            >
                                {msg.role === "model" ? (
                                    <Bot className="w-5 h-5" />
                                ) : (
                                    <User className="w-5 h-5" />
                                )}
                            </div>
                            <div
                                className={cn(
                                    "p-3 rounded-2xl text-sm whitespace-pre-wrap",
                                    msg.role === "model"
                                        ? "bg-white border text-slate-700 rounded-tl-none shadow-sm"
                                        : "bg-indigo-600 text-white rounded-tr-none shadow-md"
                                )}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-3 max-w-[90%]">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}

                    {/* Guide Mode Interface */}
                    {guideMode && !isMissionComplete && step && (
                        <div className="flex gap-3 max-w-[95%] animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-white border border-indigo-100 p-4 rounded-2xl rounded-tl-none shadow-md space-y-3 w-full">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Step {currentStep + 1} of {steps.length}</span>
                                    {isStepDone && <span className="text-xs font-bold text-green-600 flex items-center gap-1">✓ Completed</span>}
                                </div>
                                <h4 className="font-semibold text-slate-900">{step.title}</h4>
                                <p className="text-sm text-slate-600">{step.prompt}</p>
                                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border">
                                    <strong>Why?</strong> {step.rationale}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline" onClick={prevStep} disabled={currentStep === 0}>Back</Button>
                                    <Button size="sm" onClick={applyStep} disabled={isStepDone} className={cn(isStepDone ? "bg-green-600 hover:bg-green-700" : "")}>
                                        {isStepDone ? "Applied" : "Apply Fix"}
                                    </Button>
                                    <Button size="sm" variant="default" onClick={nextStep} disabled={!isStepDone}>Next</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {guideMode && isMissionComplete && (
                        <div className="flex gap-3 max-w-[95%] animate-in fade-in slide-in-from-bottom-4">
                            <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="bg-green-50 border border-green-200 p-4 rounded-2xl rounded-tl-none shadow-md space-y-2 w-full">
                                <h4 className="font-bold text-green-800">Mission Complete! 🎉</h4>
                                <p className="text-sm text-green-700">You've successfully optimized this workload. Great job!</p>
                                <Button size="sm" variant="outline" onClick={() => useSimStore.getState().setMission(null)} className="bg-white border-green-200 text-green-700 hover:bg-green-100">
                                    Back to Missions
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {SUGGESTED_QUESTIONS.map((q) => (
                            <button
                                key={q}
                                onClick={() => send(q)}
                                className="whitespace-nowrap px-3 py-1 rounded-full bg-white border text-xs text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            placeholder="Ask about your Spark run..."
                            className="flex-1 rounded-xl"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSend();
                                }
                            }}
                        />
                        <Button
                            onClick={() => handleSend()}
                            size="icon"
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
