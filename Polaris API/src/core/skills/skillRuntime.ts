import { z } from "zod";
import crypto from "node:crypto";
import { PolarisError } from "../../errors.js";

export const skillStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open_url"), url: z.string().url().refine((value) => /^https?:\/\//i.test(value), "Solo se permiten URLs HTTP/HTTPS.") }),
  z.object({ action: z.literal("reveal_path"), path: z.string().trim().min(1).max(4096) }),
  z.object({ action: z.literal("system_info") }),
  z.object({ action: z.literal("copy_text"), text: z.string().max(20_000) }),
  z.object({ action: z.literal("scroll_top") }),
  z.object({ action: z.literal("scroll_bottom") }),
  z.object({ action: z.literal("focus_chat") }),
  z.object({ action: z.literal("wait"), ms: z.number().int().min(0).max(10_000) })
]);

export const skillProgramSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
  steps: z.array(skillStepSchema).min(1).max(12)
});

export type PolarisSkillProgram = z.infer<typeof skillProgramSchema>;

export function validateSkillProgram(raw: unknown): PolarisSkillProgram {
  const parsed = skillProgramSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PolarisError(
      "VALIDATION_ERROR",
      "El skill no cumple Polaris Skill v1: solo puede usar acciones allowlisted y hasta 12 pasos.",
      400,
      { cause: parsed.error }
    );
  }

  const serialized = JSON.stringify(parsed.data);
  if (serialized.length > 32_000) {
    throw new PolarisError("VALIDATION_ERROR", "El skill supera el tamaño máximo permitido.", 400);
  }

  return parsed.data;
}

export function skillFingerprint(program: PolarisSkillProgram): string {
  return crypto.createHash("sha256")
    .update(JSON.stringify(program))
    .digest("hex")
    .slice(0, 16);
}
