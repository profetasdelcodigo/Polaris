import crypto from "node:crypto";
import { z } from "zod";

export const routineStepSchema = z.object({
  action: z.string().trim().min(1).max(160),
  capability: z.string().trim().min(1).max(160),
  requiresConfirmation: z.boolean().default(false)
});

export const routineSchema = z.object({
  name: z.string().trim().min(1).max(120),
  trigger: z.string().trim().min(1).max(160),
  steps: z.array(routineStepSchema).min(1).max(20)
});

export type PolarisRoutine = z.infer<typeof routineSchema> & {
  id: string;
  version: number;
};

export function createRoutine(input: unknown): PolarisRoutine {
  const parsed = routineSchema.parse(input);
  return {
    ...parsed,
    id: "rt_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    version: 1
  };
}

export function routinePreview(routine: PolarisRoutine) {
  return {
    id: routine.id,
    version: routine.version,
    trigger: routine.trigger,
    steps: routine.steps.map((step, index) => ({
      order: index + 1,
      ...step,
      status: step.requiresConfirmation ? "CONFIRMATION_REQUIRED" : "READY"
    })),
    safety: {
      hasHighImpactStep: routine.steps.some((step) => step.requiresConfirmation),
      arbitraryCodeAllowed: false
    }
  };
}
