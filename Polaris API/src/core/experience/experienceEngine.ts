import type { DeviceType } from "@polaris/contracts";
import { classifyIntent } from "../intent/intentClassifier.js";
import { createLatencyBudget } from "../performance/latencyBudget.js";
import { buildPersonaProfile, type PersonaProfile } from "../personality/personaEngine.js";
import { buildVisualScene } from "../visuals/visualDirector.js";

export type ExperienceBrief = {
  task: string;
  intent: ReturnType<typeof classifyIntent>;
  personality: PersonaProfile;
  preferredDevice?: DeviceType;
  latencyBudget: ReturnType<typeof createLatencyBudget>;
  visual: ReturnType<typeof buildVisualScene>;
  promises: string[];
  guardrails: string[];
};

export function buildExperienceBrief(input: {
  task: string;
  preferredDevice?: DeviceType;
  preferredMode?: string;
  tone?: string;
  responseStyle?: string;
  state?: Parameters<typeof buildVisualScene>[1];
}): ExperienceBrief {
  const task = input.task.trim().slice(0, 4_000);
  const intent = classifyIntent(task);
  const personality = buildPersonaProfile({
    task,
    preferredMode: input.preferredMode,
    tone: input.tone,
    responseStyle: input.responseStyle
  });
  const visual = buildVisualScene(personality.mode, input.state ?? "IDLE");

  return {
    task,
    intent,
    personality,
    ...(input.preferredDevice ? { preferredDevice: input.preferredDevice } : {}),
    latencyBudget: createLatencyBudget(
      intent.intent === "RESEARCH" ? "RESEARCH" : personality.mode === "OPERATOR" ? "URGENT" : "NORMAL"
    ),
    visual,
    promises: [
      "No inventar una capacidad que el dispositivo no anuncie.",
      "Observar antes de actuar cuando la tarea lo requiera.",
      "Verificar acciones remotas antes de declararlas exitosas."
    ],
    guardrails: [
      "La personalidad cambia la presentación, no las reglas de seguridad.",
      "Las acciones privilegiadas siguen la política de consentimiento.",
      "El usuario puede detener tareas y revisar Skills."
    ]
  };
}
