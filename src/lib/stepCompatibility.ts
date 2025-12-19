import { Snapshot, Knobs, StepValidationResult } from "@/types";

/**
 * Wrapper to handle both old (boolean) and new (StepValidationResult) success functions
 * This allows gradual migration of missions to the new format
 */
export function wrapSuccessFunction(
    successFn: (snap: Snapshot, knobs: Knobs) => boolean | StepValidationResult
): (snap: Snapshot, knobs: Knobs) => StepValidationResult {
    return (snap: Snapshot, knobs: Knobs): StepValidationResult => {
        const result = successFn(snap, knobs);

        // If already new format, return as-is
        if (typeof result === "object") {
            return result;
        }

        // Convert boolean to StepValidationResult
        return {
            completed: result,
            progress: result ? 100 : 0,
            feedback: result
                ? "Step completed successfully"
                : "Continue working on this step",
        };
    };
}
