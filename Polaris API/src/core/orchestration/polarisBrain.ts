import type { DeviceType, MemoryCategory } from "@polaris/contracts";
import { inspectPromptBoundary } from "../security/promptBoundary.js";
import { classifyIntent } from "../intent/intentClassifier.js";
import { createLatencyBudget } from "../performance/latencyBudget.js";
import { buildExperienceBrief } from "../experience/experienceEngine.js";
import { buildPersonalityProfile, type PersonaProfile } from "../personality/personaEngine.js";
import { buildMemoryLifecycleReport, type MemoryLike } from "../memory/memoryLifecycle.js";
import { extractMemoryCandidates, buildPersonalityProfile as buildAdaptivePersonality } from "../context/adaptiveContext.js";

export type BrainInput = {
  task: string;
  preferredDevice?: DeviceType;
  preferredMode?: string;
  tone?: string;
  responseStyle?: string;
  memories?: readonly MemoryLike[];
  devices?: readonly {
    id: string;
    name: string;
    type: DeviceType;
    status: string;
    platform?: string | null;
    room?: string | null;
  }[];
  preferences?: {
    tone?: string | null;
    response_style?: string | null;
  };
};

export function preparePolarisBrain(input: BrainInput) {
  const task = input.task.trim().slice(0, 4_000);
  const boundary = inspectPromptBoundary(task);
  const intent = classifyIntent(boundary.sanitized);
  const adaptivePersonality = buildAdaptivePersonality(
    boundary.sanitized,
    input.preferences ?? {},
    input.preferredMode
  );
  const persona: PersonaProfile = buildPersonalityProfile({
    task: boundary.sanitized,
    preferredMode: input.preferredMode,
    tone: input.tone ?? input.preferences?.tone,
    responseStyle: input.responseStyle ?? input.preferences?.response_style
  });
  const experience = buildExperienceBrief({
    task: boundary.sanitized,
    preferredDevice: input.preferredDevice,
    preferredMode: input.preferredMode,
    tone: input.tone ?? input.preferences?.tone,
    responseStyle: input.responseStyle ?? input.preferences?.response_style,
    state: "THINKING"
  });
  const memoryCandidates = extractMemoryCandidates(boundary.sanitized);
  const memoryDecisions = memoryCandidates.map((candidate) =>
    buildMemoryLifecycleReport(
      {
        content: candidate.content,
        category: candidate.category,
        importance: candidate.importance,
        source: "brain.prepare"
      },
      input.memories ? [...input.memories] : []
    )
  );

  const devices = [...(input.devices ?? [])];
  const online = devices.filter((device) => device.status.toUpperCase() === "ONLINE");
  const compatibleOnline = input.preferredDevice
    ? online.filter((device) => device.type === input.preferredDevice)
    : online;

  const latency = createLatencyBudget(
    intent.intent === "RESEARCH"
      ? "RESEARCH"
      : adaptivePersonality.mode === "URGENT" || adaptivePersonality.mode === "HANDS_FREE"
        ? "URGENT"
        : "NORMAL"
  );

  return {
    version: "1.0.0",
    task: boundary.sanitized,
    safeForAutomation: boundary.safe || intent.intent === "CHAT",
    security: {
      safe: boundary.safe,
      reasons: boundary.reasons
    },
    intent,
    adaptive: adaptivePersonality,
    persona,
    experience,
    latency,
    memory: {
      candidates: memoryCandidates,
      decisions: memoryDecisions
    },
    devices: {
      total: devices.length,
      online: online.length,
      compatibleOnline: compatibleOnline.map(({ id, name, type, status, room }) => ({
        id,
        name,
        type,
        status,
        ...(room ? { room } : {})
      }))
    },
    executionPolicy: {
      observeBeforeAct: true,
      verifyAfterAct: true,
      ambiguityRequiresStop: true,
      personalityMayChangePresentationOnly: true
    }
  };
}

export function brainCategorySummary(candidateCategories: readonly MemoryCategory[]) {
  return candidateCategories.reduce<Record<string, number>>((summary, category) => {
    summary[category] = (summary[category] ?? 0) + 1;
    return summary;
  }, {});
}
