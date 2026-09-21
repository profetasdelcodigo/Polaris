import { PolarisError } from "../../errors.js";
import { validateSkillProgram, type PolarisSkillProgram } from "./skillRuntime.js";

export type SkillMacroInput = {
  name: string;
  steps: PolarisSkillProgram["steps"];
  repeat?: number;
};

export function compileBoundedMacro(input: SkillMacroInput): PolarisSkillProgram {
  const repeat = input.repeat ?? 1;
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 5) {
    throw new PolarisError("VALIDATION_ERROR", "La repetición de un macro debe estar entre 1 y 5.", 400);
  }

  const expanded = Array.from({ length: repeat }, () => input.steps).flat();
  if (expanded.length > 12) {
    throw new PolarisError(
      "VALIDATION_ERROR",
      "El macro expandido supera el máximo de 12 pasos del runtime.",
      400
    );
  }

  return validateSkillProgram({
    version: 1,
    name: input.name.trim().slice(0, 120),
    description: `Macro generado de forma segura: ${repeat} ejecución(es).`,
    steps: expanded
  });
}
