import crypto from "node:crypto";
import type { DeviceType } from "@polaris/contracts";

export interface ContinuityCapsule {
  capsuleId: string;
  createdAt: string;
  expiresAt: string;
  conversationId?: string;
  sourceDevice?: DeviceType;
  targetDevice?: DeviceType;
  task: string;
  state: Record<string, unknown>;
  pendingSkills: readonly string[];
  checksum: string;
}

export function createContinuityCapsule(input: {
  task: string;
  conversationId?: string;
  sourceDevice?: DeviceType;
  targetDevice?: DeviceType;
  state?: Record<string, unknown>;
  pendingSkills?: readonly string[];
  ttlSeconds?: number;
}): ContinuityCapsule {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + Math.max(60, Math.min(input.ttlSeconds ?? 3600, 86_400)) * 1000);
  const body = {
    task: input.task.trim().slice(0, 10_000),
    conversationId: input.conversationId,
    sourceDevice: input.sourceDevice,
    targetDevice: input.targetDevice,
    state: input.state ?? {},
    pendingSkills: input.pendingSkills ?? []
  };
  const checksum = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 20);

  return {
    capsuleId: "cc_" + crypto.randomUUID().replaceAll("-", "").slice(0, 18),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    ...body,
    checksum
  };
}

export function validateContinuityCapsule(capsule: ContinuityCapsule): { valid: boolean; reason?: string } {
  if (Date.parse(capsule.expiresAt) <= Date.now()) return { valid: false, reason: "CAPSULE_EXPIRED" };
  const body = {
    task: capsule.task,
    conversationId: capsule.conversationId,
    sourceDevice: capsule.sourceDevice,
    targetDevice: capsule.targetDevice,
    state: capsule.state,
    pendingSkills: capsule.pendingSkills
  };
  const expected = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 20);
  return expected === capsule.checksum
    ? { valid: true }
    : { valid: false, reason: "CAPSULE_INTEGRITY_ERROR" };
}
