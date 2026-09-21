import type { DeviceType } from "@polaris/contracts";

export interface DeviceHealth {
  deviceId: string;
  type: DeviceType;
  status: string;
  online: boolean;
  stale: boolean;
  latencyClass: "FAST" | "NORMAL" | "SLOW" | "UNKNOWN";
  score: number;
  reasons: string[];
}

export function assessDeviceHealth(input: {
  deviceId: string;
  type: DeviceType;
  status: string;
  lastSeen?: string | null;
  latencyMs?: number | null;
}): DeviceHealth {
  const ageMs = input.lastSeen ? Math.max(0, Date.now() - Date.parse(input.lastSeen)) : Number.POSITIVE_INFINITY;
  const online = input.status === "ONLINE";
  const stale = ageMs > 120_000;
  const latency = input.latencyMs == null ? "UNKNOWN" : input.latencyMs < 250 ? "FAST" : input.latencyMs < 1_000 ? "NORMAL" : "SLOW";
  const reasons: string[] = [];
  if (!online) reasons.push("El dispositivo no está marcado como ONLINE.");
  if (stale) reasons.push("El último heartbeat es antiguo.");
  if (latency === "SLOW") reasons.push("La latencia observada es alta.");
  const score = Math.max(0, Math.min(100, (online ? 60 : 10) + (!stale ? 25 : 0) + (latency === "FAST" ? 15 : latency === "NORMAL" ? 10 : 0)));
  return { deviceId: input.deviceId, type: input.type, status: input.status, online, stale, latencyClass: latency, score, reasons };
}
