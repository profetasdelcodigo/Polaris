import crypto from "node:crypto";

export type PolarisEventType =
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "DEVICE_ONLINE"
  | "DEVICE_OFFLINE"
  | "SKILL_STARTED"
  | "SKILL_SUCCEEDED"
  | "SKILL_FAILED"
  | "MEMORY_CREATED"
  | "HANDOFF_STARTED"
  | "HANDOFF_COMPLETED"
  | "USER_CONFIRMATION_REQUIRED"
  | "EMERGENCY_STOP";

export interface PolarisEvent {
  id: string;
  type: PolarisEventType;
  createdAt: string;
  userId?: string;
  source?: string;
  payload: Record<string, unknown>;
}

export function createEvent(type: PolarisEventType, payload: Record<string, unknown>, userId?: string, source?: string): PolarisEvent {
  return {
    id: "evt_" + crypto.randomUUID().replaceAll("-", "").slice(0, 18),
    type,
    createdAt: new Date().toISOString(),
    ...(userId ? { userId } : {}),
    ...(source ? { source } : {}),
    payload
  };
}

export class PolarisEventBus {
  private readonly listeners = new Map<PolarisEventType, Set<(event: PolarisEvent) => void | Promise<void>>>();

  on(type: PolarisEventType, listener: (event: PolarisEvent) => void | Promise<void>): () => void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
    return () => listeners.delete(listener);
  }

  async emit(event: PolarisEvent): Promise<void> {
    await Promise.all([...this.listeners.get(event.type) ?? []].map((listener) => listener(event)));
  }
}
