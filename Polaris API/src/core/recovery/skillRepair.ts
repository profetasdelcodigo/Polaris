import type { PolarisSkillProgram } from "../skills/skillRuntime.js";

export type SkillRepair = {
  safe: boolean;
  strategy: "RETRY" | "WAIT_AND_RETRY" | "FOCUS_AND_RETRY" | "REMOVE_UNSUPPORTED_STEP" | "NO_SAFE_REPAIR";
  reason: string;
  repairedProgram?: PolarisSkillProgram;
};

export function repairSkillFailure(
  program: PolarisSkillProgram,
  failedStep: number,
  reason: string
): SkillRepair {
  if (failedStep < 0 || failedStep >= program.steps.length) {
    return { safe: false, strategy: "NO_SAFE_REPAIR", reason: "El índice del paso fallido no existe." };
  }

  const step = program.steps[failedStep]!;
  if (step.action === "wait") {
    return { safe: false, strategy: "NO_SAFE_REPAIR", reason: "No se puede reparar una espera fallida automáticamente." };
  }

  if (reason.toLowerCase().includes("busy") || reason.toLowerCase().includes("loading")) {
    const steps = [...program.steps];
    steps.splice(failedStep, 0, { action: "wait", ms: 750 });
    if (steps.length > 12) {
      return { safe: false, strategy: "NO_SAFE_REPAIR", reason: "El runtime no permite añadir pasos al programa." };
    }
    return {
      safe: true,
      strategy: "WAIT_AND_RETRY",
      reason: "El fallo parece transitorio; se añadió una espera acotada antes de reintentar.",
      repairedProgram: { ...program, name: `${program.name} · recovery`, steps }
    };
  }

  if (step.action === "focus_chat") {
    return {
      safe: true,
      strategy: "FOCUS_AND_RETRY",
      reason: "Se reintentará el paso de foco una sola vez.",
      repairedProgram: { ...program, name: `${program.name} · focus-retry`, steps: [...program.steps] }
    };
  }

  if (reason.toLowerCase().includes("unsupported")) {
    const steps = program.steps.filter((_, index) => index !== failedStep);
    if (!steps.length) {
      return { safe: false, strategy: "NO_SAFE_REPAIR", reason: "Eliminar el paso dejaría el Skill vacío." };
    }
    return {
      safe: true,
      strategy: "REMOVE_UNSUPPORTED_STEP",
      reason: "El paso fue marcado como no soportado; se elimina sin ejecutar código alternativo.",
      repairedProgram: { ...program, name: `${program.name} · reduced`, steps }
    };
  }

  return { safe: false, strategy: "NO_SAFE_REPAIR", reason: "No existe una reparación segura predefinida para este fallo." };
}
