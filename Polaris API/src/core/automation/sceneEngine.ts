import type { DeviceAction } from "../devices/deviceFabric.js";

export type SceneRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SceneStep = {
  deviceId: string;
  action: DeviceAction;
  value?: string | number | boolean;
  afterMs?: number;
};

export type SceneDefinition = {
  id?: string;
  name: string;
  description?: string;
  steps: SceneStep[];
};

export type CompiledScene = {
  version: 1;
  name: string;
  fingerprint: string;
  strategy: "PARALLEL_WHEN_POSSIBLE";
  groups: Array<{
    index: number;
    delayMs: number;
    steps: SceneStep[];
  }>;
  risk: SceneRisk;
  requiresConfirmation: boolean;
};

function riskFor(action: DeviceAction): SceneRisk {
  if (action === "REBOOT" || action === "LOCK" || action === "UNLOCK") return "HIGH";
  if (action === "SET_TEMPERATURE" || action === "SET_CHANNEL" || action === "OPEN_APP") return "MEDIUM";
  return "LOW";
}

function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const character of JSON.stringify(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function compileScene(scene: SceneDefinition): CompiledScene {
  const name = scene.name.trim();
  if (!name) throw new Error("La escena necesita un nombre.");
  if (scene.steps.length < 1 || scene.steps.length > 24) {
    throw new Error("Una escena Polaris puede tener entre 1 y 24 pasos.");
  }

  const risk = scene.steps.reduce<SceneRisk>((highest, step) => {
    const next = riskFor(step.action);
    const rank: Record<SceneRisk, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return rank[next] > rank[highest] ? next : highest;
  }, "LOW");

  const groups: CompiledScene["groups"] = [];
  let current: SceneStep[] = [];
  let delayMs = 0;

  for (const step of scene.steps) {
    if (step.afterMs && step.afterMs > 0) {
      if (current.length) groups.push({ index: groups.length, delayMs, steps: current });
      current = [];
      delayMs = Math.min(30_000, Math.max(0, Math.trunc(step.afterMs)));
    }
    current.push({ ...step, ...(step.afterMs !== undefined ? { afterMs: undefined } : {}) });
  }
  if (current.length) groups.push({ index: groups.length, delayMs, steps: current });

  const normalized = {
    version: 1,
    name,
    description: scene.description?.trim().slice(0, 500),
    groups
  };

  return {
    version: 1,
    name,
    fingerprint: fingerprint(normalized),
    strategy: "PARALLEL_WHEN_POSSIBLE",
    groups,
    risk,
    requiresConfirmation: risk === "HIGH" || risk === "CRITICAL"
  };
}
