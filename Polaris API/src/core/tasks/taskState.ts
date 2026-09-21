import crypto from "node:crypto";

export type TaskStatus = "QUEUED" | "RUNNING" | "PAUSED" | "WAITING_USER" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface TaskCheckpoint {
  id: string;
  createdAt: string;
  label: string;
  state: Record<string, unknown>;
}

export interface PolarisTaskState {
  taskId: string;
  objective: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  progress: number;
  currentStep?: string;
  checkpoints: TaskCheckpoint[];
  cancellationRequested: boolean;
  error?: string;
}

export function createTaskState(objective: string): PolarisTaskState {
  const now = new Date().toISOString();
  return {
    taskId: "task_" + crypto.randomUUID().replaceAll("-", "").slice(0, 18),
    objective: objective.trim().slice(0, 10_000),
    status: "QUEUED",
    createdAt: now,
    updatedAt: now,
    progress: 0,
    checkpoints: [],
    cancellationRequested: false
  };
}

export function updateTaskState(
  task: PolarisTaskState,
  patch: Partial<Pick<PolarisTaskState, "status" | "progress" | "currentStep" | "error">>
): PolarisTaskState {
  return { ...task, ...patch, progress: Math.max(0, Math.min(100, patch.progress ?? task.progress)), updatedAt: new Date().toISOString() };
}

export function checkpointTask(task: PolarisTaskState, label: string, state: Record<string, unknown>): PolarisTaskState {
  const checkpoint: TaskCheckpoint = {
    id: "cp_" + crypto.randomUUID().replaceAll("-", "").slice(0, 14),
    createdAt: new Date().toISOString(),
    label: label.trim().slice(0, 160),
    state
  };
  return { ...task, checkpoints: [...task.checkpoints, checkpoint].slice(-20), updatedAt: checkpoint.createdAt };
}

export function cancelTask(task: PolarisTaskState): PolarisTaskState {
  return updateTaskState({ ...task, cancellationRequested: true }, { status: "CANCELLED" });
}
