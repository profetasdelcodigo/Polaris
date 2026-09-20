export type PolarisState =
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "EXECUTING"
  | "SPEAKING"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "OFFLINE";

export type MessageRole = "user" | "assistant" | "system" | "tool";
export type MemoryCategory = "PERSONAL" | "PREFERENCE" | "PROJECT" | "CONTEXT" | "FACT" | "GOAL";

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface PolarisMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  status?: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  metadata?: Record<string, unknown>;
}

export interface Memory {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: number;
  source: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface Device {
  id: string;
  name: string;
  type: "WEB" | "ANDROID" | "DESKTOP" | "ROBOT";
  platform: string;
  status: string;
  last_seen: string | null;
  created_at: string;
}

export interface Preferences {
  language: string;
  theme: "dark" | "light" | "system";
  tone: string;
  response_style: string;
  voice_settings: Record<string, unknown>;
  notifications: Record<string, unknown>;
  privacy_settings: Record<string, unknown>;
}


export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  language: "es" | "en";
  timezone: string;
  created_at: string;
  updated_at: string;
}
