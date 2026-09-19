export type {
  Database,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate
} from "./database.types";

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
  voice: false;
  vision: false;
  robot: false;
  webSearch: false;
  desktopTools: false;
  calendar: false;
}

export type ServerSentEventName =
  | "message.accepted"
  | "message.delta"
  | "message.done"
  | "tool.started"
  | "tool.completed"
  | "error";

