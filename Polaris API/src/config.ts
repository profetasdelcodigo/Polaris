import { z } from "zod";

const optionalNonEmpty = z.string().trim().min(1).optional();

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://127.0.0.1:5173,tauri://localhost,http://tauri.localhost"),
  SUPABASE_URL: optionalNonEmpty,
  SUPABASE_PUBLISHABLE_KEY: optionalNonEmpty,
  SUPABASE_SERVICE_ROLE_KEY: optionalNonEmpty,
  AI_PROVIDER: z.enum(["openai", "gemini", "anthropic", "local"]).default("openai"),
  AI_MODEL: z.string().trim().min(1).default("gpt-5.5"),
  OPENAI_API_KEY: optionalNonEmpty,
  REQUEST_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(500).default(30)
});

export type PolarisConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  host: string;
  corsOrigins: string[];
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseServiceRoleKey?: string;
  aiProvider: "openai" | "gemini" | "anthropic" | "local";
  aiModel: string;
  openAiApiKey?: string;
  requestRateLimitMax: number;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): PolarisConfig {
  const parsed = environmentSchema.parse(environment);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    host: parsed.HOST,
    corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    supabaseUrl: parsed.SUPABASE_URL,
    supabasePublishableKey: parsed.SUPABASE_PUBLISHABLE_KEY,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    aiProvider: parsed.AI_PROVIDER,
    aiModel: parsed.AI_MODEL,
    openAiApiKey: parsed.OPENAI_API_KEY,
    requestRateLimitMax: parsed.REQUEST_RATE_LIMIT_MAX
  };
}

export function hasSupabaseConfiguration(config: PolarisConfig): config is PolarisConfig & {
  supabaseUrl: string;
  supabasePublishableKey: string;
} {
  return Boolean(config.supabaseUrl && config.supabasePublishableKey);
}
