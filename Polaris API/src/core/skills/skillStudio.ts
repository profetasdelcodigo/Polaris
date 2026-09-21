import { composeSkillFromIntent } from "./skillComposer.js";
import { skillFingerprint, validateSkillProgram, type PolarisSkillProgram } from "./skillRuntime.js";

export type SkillStudioResult = {
  safe: boolean;
  runtime: "polaris-skill-v1";
  fingerprint: string;
  program: PolarisSkillProgram;
  explanation: string[];
  guardrails: string[];
  suggestedConfirmation: boolean;
};

const blockedWords = [
  /shell/i,
  /terminal/i,
  /powershell/i,
  /bash/i,
  /javascript/i,
  /eval\s*\(/i,
  /código arbitrario/i,
  /ejecuta código/i,
  /desactiva seguridad/i,
  /omite permisos/i
];

export function designSkill(task: string): SkillStudioResult {
  const trimmed = task.trim();
  const blocked = blockedWords.some((pattern) => pattern.test(trimmed));
  if (blocked) {
    throw new Error("Polaris Skill Studio no genera ejecución arbitraria: solo compone acciones allowlisted.");
  }

  const program = validateSkillProgram(composeSkillFromIntent(trimmed));
  const explanation = program.steps.map((step, index) => {
    const detail =
      step.action === "open_url" ? "abrirá una URL HTTP/HTTPS" :
      step.action === "copy_text" ? "copiará texto al portapapeles" :
      step.action === "system_info" ? "consultará información del sistema" :
      step.action === "focus_chat" ? "enfocará el chat" :
      step.action === "wait" ? `esperará ${step.ms} ms` :
      step.action === "scroll_top" ? "subirá al inicio" :
      step.action === "scroll_bottom" ? "bajará al final" :
      "mostrará una ruta autorizada";
    return `Paso ${index + 1}: ${detail}.`;
  });

  const suggestedConfirmation = program.steps.some((step) => step.action === "reveal_path");

  return {
    safe: true,
    runtime: "polaris-skill-v1",
    fingerprint: skillFingerprint(program),
    program,
    explanation,
    guardrails: [
      "Solo acciones declaradas por Polaris Skill v1.",
      "Máximo 12 pasos y espera máxima de 10 segundos.",
      "Sin shell, JavaScript arbitrario, eval ni comandos nativos generados por el modelo.",
      "El fingerprint permite auditar exactamente el programa propuesto."
    ],
    suggestedConfirmation
  };
}
