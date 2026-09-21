export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate
} from "./database.types.js";

export const POLARIS_VERSION = "0.1.0" as const;

export const polarisStates = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "EXECUTING",
  "SPEAKING",
  "SUCCESS",
  "WARNING",
  "ERROR",
  "OFFLINE"
] as const;

export type PolarisState = (typeof polarisStates)[number];

export const memoryCategories = [
  "PERSONAL",
  "PREFERENCE",
  "PROJECT",
  "CONTEXT",
  "FACT",
  "GOAL"
] as const;

export type MemoryCategory = (typeof memoryCategories)[number];

export const deviceTypes = ["WEB", "ANDROID", "DESKTOP", "ROBOT"] as const;
export type DeviceType = (typeof deviceTypes)[number];

export const messageRoles = ["user", "assistant", "system", "tool"] as const;
export type MessageRole = (typeof messageRoles)[number];

export const capabilityAvailability = [
  "AVAILABLE",
  "PERMISSION_REQUIRED",
  "OFFLINE",
  "NOT_IMPLEMENTED"
] as const;

export type CapabilityAvailability = (typeof capabilityAvailability)[number];

export const capabilityKinds = [
  "CORE",
  "WEB",
  "ANDROID",
  "DESKTOP",
  "ROBOT",
  "REMOTE"
] as const;

export type CapabilityKind = (typeof capabilityKinds)[number];

export interface PublicCapability {
  id: string;
  name: string;
  description: string;
  kinds: readonly CapabilityKind[];
  availability: Record<DeviceType, CapabilityAvailability>;
  requiresConfirmation: boolean;
  danger: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  composable: boolean;
}

export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "AVAILABLE" | "PARTIAL" | "PLANNED";
  supportedDevices: readonly DeviceType[];
  requiresConfirmation: boolean;
}

export interface ApiProblem {
  code:
    | "AUTH_ERROR"
    | "NETWORK_ERROR"
    | "PROVIDER_ERROR"
    | "TIMEOUT"
    | "DATABASE_ERROR"
    | "PERMISSION_DENIED"
    | "VALIDATION_ERROR"
    | "RATE_LIMIT"
    | "NOT_FOUND"
    | "INTERNAL_ERROR";
  message: string;
  requestId?: string;
}

export interface Capabilities {
  chat: boolean;
  streaming: boolean;
  memory: boolean;
  voice: boolean;
  vision: boolean;
  robot: boolean;
  webSearch: boolean;
  desktopTools: boolean;
  calendar: boolean;
  relay: boolean;
  registryVersion: string;
  deviceMatrix: Record<DeviceType, CapabilityAvailability>;
  capabilities: readonly PublicCapability[];
}

export type ServerSentEventName =
  | "message.accepted"
  | "message.delta"
  | "message.done"
  | "tool.started"
  | "tool.completed"
  | "error";
