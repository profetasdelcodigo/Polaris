import crypto from "node:crypto";
import type { DeviceAction } from "../devices/deviceFabric.js";

export type SceneRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SceneStep = {
  deviceId: string;
  action: DeviceAction;
  value?: string | number | boolean;
  afterMs?: number;
  rollback?: {
    action: DeviceAction;
    value?: string | number | boolean;
  };
};

export type SceneDefinition = {
  id?: string;
  name: string;
  description?: string;
  steps: SceneStep[];
};

export type CompiledScene = {
  version: 2;
  name: string;
  fingerprint: string;
  idempotencyKey: string;
  strategy: "PARALLEL_WHEN_POSSIBLE";
  groups: Array<{
    index: number;
    delayMs: number;
    steps: SceneStep[];
  }>;
  risk: SceneRisk;
  requiresConfirmation: boolean;
  recovery: {
    mode: "ROLLBACK_WHERE_DEFINED" | "STOP_AND_REPORT";
    rollbackSteps: number;
  };
};

function riskFor(action: DeviceAction): SceneRisk {
  if (action === "REBOOT" || action === "LOCK" || action === "UNLOCK") return "HIGH";
  if (action === "SET_TEMPERATURE" || action === "SET_CHANNEL" || action === "OPEN_APP") return "MEDIUM";
  return "LOW";
}

function fingerprint(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function normalizeDelay(value?: number): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) throw new Error("afterMs debe ser un número finito no negativo.");
  return Math.min(30_000, Math.trunc(value));
}

export function compileScene(scene: SceneDefinition): CompiledScene {
  const name = scene.name.trim();
  if (!name) throw new Error("La escena necesita un nombre.");
  if (scene.steps.length < 1 || scene.steps.length > 24) {
    throw new Error("Una escena Polaris puede tener entre 1 y 24 pasos.");
  }

  const duplicateIds = scene.steps
    .map((step) => step.deviceId.trim())
    .filter((id, index, ids) => id && ids.indexOf(id) !== index);
  if (duplicateIds.length === 0 && scene.steps.some((step) => !step.deviceId.trim())) {
    throw new Error("Cada paso necesita un deviceId.");
  }

  const risk = scene.steps.reduce<SceneRisk>((highest, step) => {
    const next = riskFor(step.action);
    const rank: Record<SceneRisk, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return rank[next] > rank[highest] ? next : highest;
  }, "LOW");

  const groups: CompiledScene["groups"] = [];
  let current: SceneStep[] = [];
  let delayMs = 0;

  for (const rawStep of scene.steps) {
    const step = {
      ...rawStep,
      deviceId: rawStep.deviceId.trim(),
      afterMs: undefined
    };
    const stepDelay = normalizeDelay(rawStep.afterMs);
    if (stepDelay > 0) {
      if (current.length) groups.push({ index: groups.length, delayMs, steps: current });
      current = [];
      delayMs = stepDelay;
    }
    current.push(step);
  }
  if (current.length) groups.push({ index: groups.length, delayMs, steps: current });

  const normalized = {
    version: 2,
    name,
    description: scene.description?.trim().slice(0, 500),
    groups
  };
  const fingerprintValue = fingerprint(normalized);

  return {
    version: 2,
    name,
    fingerprint: fingerprintValue,
    idempotencyKey: `scene:${fingerprintValue}`,
    strategy: "PARALLEL_WHEN_POSSIBLE",
    groups,
    risk,
    requiresConfirmation: risk === "HIGH" || risk === "CRITICAL",
    recovery: {
      mode: groups.some((group) => group.steps.some((step) => step.rollback))
        ? "ROLLBACK_WHERE_DEFINED"
        : "STOP_AND_REPORT",
      rollbackSteps: groups.reduce(
        (count, group) => count + group.steps.filter((step) => step.rollback).length,
        0
      )
    }
  };
}
