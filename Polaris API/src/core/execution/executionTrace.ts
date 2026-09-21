import crypto from "node:crypto";
import type { DeviceType } from "@polaris/contracts";

export type TraceStatus = "PLANNED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "RECOVERED";

export interface ExecutionTraceStep {
  id: string;
  action: string;
  device?: DeviceType;
  status: TraceStatus;
  startedAt?: string;
  finishedAt?: string;
  verification?: string;
  error?: string;
}

export interface ExecutionTrace {
  traceId: string;
  createdAt: string;
  task: string;
  fingerprint?: string;
  targetDeviceId?: string;
  status: TraceStatus;
  steps: ExecutionTraceStep[];
}

export function createExecutionTrace(input: {
  task: string;
  fingerprint?: string;
  targetDeviceId?: string;
  actions: readonly { action: string; device?: DeviceType }[];
}): ExecutionTrace {
  const createdAt = new Date().toISOString();
  return {
    traceId: "tr_" + crypto.randomUUID().replaceAll("-", "").slice(0, 20),
    createdAt,
    task: input.task,
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.targetDeviceId ? { targetDeviceId: input.targetDeviceId } : {}),
    status: "PLANNED",
    steps: input.actions.map((step, index) => ({
      id: "trace-" + (index + 1),
      action: step.action,
      ...(step.device ? { device: step.device } : {}),
      status: "PLANNED"
    }))
  };
}

export function finishTrace(
  trace: ExecutionTrace,
  status: Extract<TraceStatus, "SUCCEEDED" | "FAILED" | "RECOVERED">,
  verification?: string
): ExecutionTrace {
  return {
    ...trace,
    status,
    steps: trace.steps.map((step) => ({
      ...step,
      status,
      ...(verification ? { verification } : {})
    }))
  };
}
