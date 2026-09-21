import type { DeviceType, MemoryCategory } from "@polaris/contracts";

export type AdaptiveMode =
  | "NORMAL"
  | "STUDY"
  | "PROGRAMMING"
  | "RESEARCH"
  | "URGENT"
  | "HANDS_FREE"
  | "FOCUS";

export interface PersonalityProfile {
  mode: AdaptiveMode;
  tone: string;
  responseStyle: string;
  concise: boolean;
  explainMore: boolean;
  voiceFriendly: boolean;
}

const normalize = (value: string) =>
  value.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function inferAdaptiveMode(task: string, preferredMode?: string | null): AdaptiveMode {
  const explicit = normalize(preferredMode ?? "");
  if (["estudio", "study"].includes(explicit)) return "STUDY";
  if (["programacion", "programming", "codigo", "code"].includes(explicit)) return "PROGRAMMING";
  if (["investigacion", "research"].includes(explicit)) return "RESEARCH";
  if (["urgente", "urgent"].includes(explicit)) return "URGENT";
  if (["manos libres", "hands free", "voz"].includes(explicit)) return "HANDS_FREE";
  if (["concentracion", "focus"].includes(explicit)) return "FOCUS";

  const text = normalize(task);
  if (/(urgente|emergencia|rapido|rápido|ahora mismo)/.test(text)) return "URGENT";
  if (/(investiga|investigacion|investigación|fuentes|compara fuentes|paper|documentacion)/.test(text)) return "RESEARCH";
  if (/(codigo|código|programa|debug|bug|error|typescript|javascript|kotlin|rust|python)/.test(text)) return "PROGRAMMING";
  if (/(estudiar|estudio|tarea|examen|matematica|matemática|clase)/.test(text)) return "STUDY";
  if (/(manos libres|escuchame|escúchame|habla conmigo)/.test(text)) return "HANDS_FREE";
  if (/(concentracion|concentración|enfocate|enfócate|sin distracciones)/.test(text)) return "FOCUS";
  return "NORMAL";
}

export function buildPersonalityProfile(
  task: string,
  preferences: { tone?: string | null; response_style?: string | null },
  preferredMode?: string | null
): PersonalityProfile {
  const mode = inferAdaptiveMode(task, preferredMode);
  const tone = preferences.tone?.trim() || "natural";
  const responseStyle = preferences.response_style?.trim() || "equilibrado";

  return {
    mode,
    tone,
    responseStyle,
    concise: mode === "URGENT" || mode === "HANDS_FREE",
    explainMore: mode === "STUDY" || mode === "PROGRAMMING" || mode === "RESEARCH",
    voiceFriendly: mode === "HANDS_FREE" || mode === "URGENT"
  };
}

export interface MemoryCandidate {
  category: MemoryCategory;
  content: string;
  importance: number;
  reason: "explicit_preference" | "persistent_goal" | "project_context";
}

export function extractMemoryCandidates(message: string): MemoryCandidate[] {
  const normalized = normalize(message);
  const candidates: MemoryCandidate[] = [];

  const preferenceMatch = message.match(/(?:prefiero|prefiere|me gusta|no me gusta|siempre quiero|quiero que Polaris)\s+(.{3,180})/i);
  if (preferenceMatch) {
    candidates.push({
      category: "PREFERENCE",
      content: preferenceMatch[0].trim(),
      importance: 4,
      reason: "explicit_preference"
    });
  }

  const goalMatch = message.match(/(?:mi objetivo es|mi meta es|quiero lograr|estoy intentando)\s+(.{3,180})/i);
  if (goalMatch) {
    candidates.push({
      category: "GOAL",
      content: goalMatch[0].trim(),
      importance: 4,
      reason: "persistent_goal"
    });
  }

  if (/(polaris|proyecto|repositorio|aplicacion|aplicación|web|android|pc)/i.test(normalized) && message.length >= 30) {
    candidates.push({
      category: "PROJECT",
      content: message.trim().slice(0, 500),
      importance: 3,
      reason: "project_context"
    });
  }

  return candidates.slice(0, 3);
}

export interface AdaptiveContext {
  profile: unknown;
  preferences: unknown;
  memories: readonly unknown[];
  devices: readonly {
    id: string;
    name: string;
    type: DeviceType;
    status: string;
    platform?: string | null;
  }[];
  personality: PersonalityProfile;
}

export function summarizeAdaptiveContext(context: AdaptiveContext) {
  return {
    mode: context.personality.mode,
    tone: context.personality.tone,
    responseStyle: context.personality.responseStyle,
    memoryCount: context.memories.length,
    onlineDevices: context.devices.filter((device) => device.status === "ONLINE").map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type
    }))
  };
}
