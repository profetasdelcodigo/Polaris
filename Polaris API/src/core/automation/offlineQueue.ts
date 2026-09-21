import crypto from "node:crypto";

export type QueueState = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export type OfflineQueueItem = {
  id: string;
  userId: string;
  task: string;
  targetDeviceId?: string;
  createdAt: string;
  attempts: number;
  maxAttempts: number;
  state: QueueState;
  idempotencyKey: string;
  safeToReplay: boolean;
};

export function createOfflineQueueItem(input: {
  userId: string;
  task: string;
  targetDeviceId?: string;
  safeToReplay?: boolean;
  maxAttempts?: number;
}): OfflineQueueItem {
  const createdAt = new Date().toISOString();
  const idempotencyKey = crypto.createHash("sha256")
    .update(JSON.stringify({
      userId: input.userId,
      task: input.task.trim(),
      targetDeviceId: input.targetDeviceId ?? null
    }))
    .digest("hex");

  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    task: input.task.trim(),
    ...(input.targetDeviceId ? { targetDeviceId: input.targetDeviceId } : {}),
    createdAt,
    attempts: 0,
    maxAttempts: Math.min(5, Math.max(1, input.maxAttempts ?? 3)),
    state: "PENDING",
    idempotencyKey,
    safeToReplay: input.safeToReplay ?? true
  };
}

export function nextQueueState(
  item: OfflineQueueItem,
  result: "RETRY" | "SUCCESS" | "FAIL" | "CANCEL"
): OfflineQueueItem {
  if (item.state === "SUCCEEDED" || item.state === "CANCELLED") return item;
  if (result === "SUCCESS") return { ...item, state: "SUCCEEDED" };
  if (result === "CANCEL") return { ...item, state: "CANCELLED" };
  if (result === "FAIL") return { ...item, state: "FAILED", attempts: item.attempts + 1 };
  if (!item.safeToReplay || item.attempts + 1 >= item.maxAttempts) {
    return { ...item, state: "FAILED", attempts: item.attempts + 1 };
  }
  return { ...item, state: "PENDING", attempts: item.attempts + 1 };
}

export function offlineQueuePreview(items: readonly OfflineQueueItem[]) {
  return {
    pending: items.filter((item) => item.state === "PENDING").length,
    running: items.filter((item) => item.state === "RUNNING").length,
    failed: items.filter((item) => item.state === "FAILED").length,
    replayable: items.filter((item) => item.state === "PENDING" && item.safeToReplay).length,
    items
  };
}
