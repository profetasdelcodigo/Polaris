import type { Json } from "@polaris/contracts";
import { z } from "zod";

export const identifierSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100)
});

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).default("Nueva conversación")
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

export const createMemorySchema = z.object({
  category: z.enum(["PERSONAL", "PREFERENCE", "PROJECT", "CONTEXT", "FACT", "GOAL"]),
  content: z.string().trim().min(1).max(10_000),
  importance: z.number().int().min(1).max(5).default(3)
});

export const updateMemorySchema = createMemorySchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "Incluye al menos un campo para actualizar."
);

const jsonObjectSchema = z.record(z.string(), z.unknown()).transform((value) => value as Json);

export const updatePreferencesSchema = z.object({
  language: z.enum(["es", "en"]).optional(),
  theme: z.enum(["dark", "light", "system"]).optional(),
  tone: z.string().trim().min(1).max(80).optional(),
  response_style: z.string().trim().min(1).max(80).optional(),
  voice_settings: jsonObjectSchema.optional(),
  notifications: jsonObjectSchema.optional(),
  privacy_settings: jsonObjectSchema.optional()
}).refine((input) => Object.keys(input).length > 0, "Incluye al menos una preferencia.");

export const updateProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  avatar_url: z.url().max(2048).nullable().optional(),
  language: z.enum(["es", "en"]).optional(),
  timezone: z.string().trim().min(1).max(100).optional()
}).refine((input) => Object.keys(input).length > 0, "Incluye al menos un campo de perfil.");

export const registerDeviceSchema = z.object({
  clientId: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["WEB", "ANDROID", "DESKTOP", "ROBOT"]),
  platform: z.string().trim().min(1).max(120),
  status: z.enum(["ONLINE", "OFFLINE", "CONNECTING", "ERROR"]).default("ONLINE"),
  metadata: jsonObjectSchema.default({})
});

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(20_000).optional(),
  message: z.string().trim().min(1).max(20_000).optional(),
  client: z.object({
    platform: z.enum(["WEB", "ANDROID", "DESKTOP"]).optional(),
    timezone: z.string().trim().max(100).optional()
  }).optional()
}).superRefine((value, context) => {
  if (!value.content && !value.message) {
    context.addIssue({ code: "custom", path: ["content"], message: "Se requiere un mensaje." });
  }
});

export const toolInvocationSchema = z.object({
  input: z.unknown().default({})
});
