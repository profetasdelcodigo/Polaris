import { z } from "zod";
import { calculateExpression } from "./calculator.js";
import {
  createMemory,
  getPreferences,
  getProfile,
  listConversations,
  listDevices,
  listRelevantMemories
} from "../../data/polarisRepository.js";
import { createRelayCommand } from "../relay/deviceCommandRepository.js";
import type { AuthenticatedContext } from "../../auth.js";
import { PolarisError } from "../../errors.js";
import type { AIToolDefinition } from "../ai/types.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ToolCategory =
  | "INFORMATION"
  | "PRODUCTIVITY"
  | "SYSTEM"
  | "FILES"
  | "WEB"
  | "MEDIA"
  | "COMMUNICATION"
  | "CALENDAR"
  | "VISION"
  | "ROBOT"
  | "DEVELOPER"
  | "AUTOMATION";

type ToolExecutionContext = Pick<AuthenticatedContext, "db" | "user">;

export interface ToolDefinition<TInput extends z.ZodType, TResult> {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  timeoutMs: number;
  modelCallable: boolean;
  inputSchema: TInput;
  execute(context: ToolExecutionContext, input: z.infer<TInput>, signal: AbortSignal): Promise<TResult>;
}

const getTimeSchema = z.object({
  timezone: z.string().trim().min(1).max(100)
});
const calculatorSchema = z.object({ expression: z.string().trim().min(1).max(200) });
const saveMemorySchema = z.object({
  content: z.string().trim().min(1).max(10_000),
  category: z
    .enum(["PERSONAL", "PREFERENCE", "PROJECT", "CONTEXT", "FACT", "GOAL"])
    .default("CONTEXT"),
  importance: z.number().int().min(1).max(5).default(3)
});
const searchMemorySchema = z.object({ query: z.string().trim().max(180) });
const listConversationsSchema = z.object({});
const getProfileSchema = z.object({});
const getPreferencesSchema = z.object({});
const listDevicesSchema = z.object({});
const relayCommandSchema = z.object({
  targetDeviceId: z.string().uuid().optional(),
  action: z.enum([
    "desktop.open_url",
    "desktop.reveal_path",
    "desktop.system_info",
    "android.back",
    "android.home",
    "android.notifications",
    "android.quick_settings",
    "android.recents",
    "android.open_settings",
    "android.open_wifi",
    "android.open_bluetooth",
    "android.scroll_up",
    "android.scroll_down",
    "android.tap_text"
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
  requiresConfirmation: z.boolean().default(true)
});

const tools = [
  {
    name: "get_time",
    description: "Obtiene la fecha y hora actual de una zona horaria IANA.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 1_000,
    modelCallable: true,
    inputSchema: getTimeSchema,
    async execute(_context: ToolExecutionContext, input: z.infer<typeof getTimeSchema>, _signal: AbortSignal) {
      try {
        const now = new Date();
        return {
          timezone: input.timezone,
          iso: now.toISOString(),
          formatted: new Intl.DateTimeFormat("es-PE", {
            dateStyle: "full",
            timeStyle: "medium",
            timeZone: input.timezone
          }).format(now)
        };
      } catch {
        throw new PolarisError("VALIDATION_ERROR", "La zona horaria no es válida.", 400);
      }
    }
  },
  {
    name: "calculator",
    description: "Resuelve una expresión aritmética sin ejecutar código.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 1_000,
    modelCallable: true,
    inputSchema: calculatorSchema,
    async execute(_context: ToolExecutionContext, input: z.infer<typeof calculatorSchema>, _signal: AbortSignal) {
      return { expression: input.expression, result: calculateExpression(input.expression) };
    }
  },
  {
    name: "save_memory",
    description: "Guarda una memoria explícita y controlable del usuario.",
    category: "PRODUCTIVITY",
    riskLevel: "MEDIUM",
    timeoutMs: 5_000,
    modelCallable: false,
    inputSchema: saveMemorySchema,
    async execute(context: ToolExecutionContext, input: z.infer<typeof saveMemorySchema>, _signal: AbortSignal) {
      const memory = await createMemory(context, {
        content: input.content,
        category: input.category,
        importance: input.importance,
        source: "tool"
      }, _signal);
      return { id: memory.id, category: memory.category, content: memory.content };
    }
  },
  {
    name: "search_memory",
    description: "Busca memorias que pertenecen solamente al usuario actual.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 5_000,
    modelCallable: true,
    inputSchema: searchMemorySchema,
    async execute(context: ToolExecutionContext, input: z.infer<typeof searchMemorySchema>, _signal: AbortSignal) {
      const memories = await listRelevantMemories(context, input.query, 8, _signal);
      return memories.map((memory) => ({
        id: memory.id,
        category: memory.category,
        content: memory.content,
        importance: memory.importance
      }));
    }
  },
  {
    name: "list_conversations",
    description: "Lista conversaciones que pertenecen solamente al usuario actual.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 5_000,
    modelCallable: true,
    inputSchema: listConversationsSchema,
    async execute(context: ToolExecutionContext, _input: z.infer<typeof listConversationsSchema>, _signal: AbortSignal) {
      const conversations = await listConversations(context, 100, _signal);
      return conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updated_at
      }));
    }
  }
,  {
    name: "get_profile",
    description: "Obtiene los datos de perfil no sensibles del usuario actual.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 3_000,
    modelCallable: true,
    inputSchema: getProfileSchema,
    async execute(context: ToolExecutionContext, _input: z.infer<typeof getProfileSchema>, _signal: AbortSignal) {
      const profile = await getProfile(context);
      return {
        displayName: profile.display_name,
        language: profile.language,
        timezone: profile.timezone,
        avatarUrl: profile.avatar_url
      };
    }
  },
  {
    name: "get_preferences",
    description: "Obtiene las preferencias actuales del usuario para adaptar la experiencia.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 3_000,
    modelCallable: true,
    inputSchema: getPreferencesSchema,
    async execute(context: ToolExecutionContext, _input: z.infer<typeof getPreferencesSchema>, _signal: AbortSignal) {
      const preferences = await getPreferences(context);
      return {
        language: preferences.language,
        theme: preferences.theme,
        tone: preferences.tone,
        responseStyle: preferences.response_style
      };
    }
  },
  {
    name: "list_devices",
    description: "Lista los dispositivos Polaris asociados al usuario actual sin exponer secretos.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 3_000,
    modelCallable: true,
    inputSchema: listDevicesSchema,
    async execute(context: ToolExecutionContext, _input: z.infer<typeof listDevicesSchema>, _signal: AbortSignal) {
      const devices = await listDevices(context);
      return devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        platform: device.platform,
        status: device.status,
        lastSeen: device.last_seen
      }));
    }
  },
  {
    name: "queue_device_command",
    description: "Encola una orden explícita para un dispositivo Polaris del mismo usuario. Solo permite acciones nativas previamente registradas.",
    category: "AUTOMATION",
    riskLevel: "HIGH",
    timeoutMs: 5_000,
    modelCallable: false,
    inputSchema: relayCommandSchema,
    async execute(context: ToolExecutionContext, input: z.infer<typeof relayCommandSchema>, _signal: AbortSignal) {
      const devices = await listDevices(context, 50, _signal);
      const target = input.targetDeviceId
        ? devices.find((device) => device.id === input.targetDeviceId)
        : devices
            .filter((device) => device.type === "DESKTOP")
            .sort((a, b) => Number(b.status === "ONLINE") - Number(a.status === "ONLINE"))[0];

      if (!target) {
        throw new PolarisError("NOT_FOUND", "No hay un PC Polaris registrado para recibir la orden.", 404);
      }

      const requiresConfirmation = input.action === "desktop.open_url"
        ? false
        : input.action.startsWith("android.") && input.action !== "android.tap_text"
          ? false
          : true;

      const command = await createRelayCommand(context, {
        targetDeviceId: target.id,
        capabilityId: input.action,
        action: input.action,
        payload: input.payload,
        requiresConfirmation
      });

      return {
        queued: true,
        commandId: command.id,
        targetDeviceId: target.id,
        targetName: target.name,
        action: command.action,
        requiresConfirmation: command.requires_confirmation
      };
    }
  }
] as const;

export type RegisteredToolName = (typeof tools)[number]["name"];

export class ToolEngine {
  public list(): readonly (typeof tools)[number][] {
    return tools;
  }

  public aiDefinitions(): readonly AIToolDefinition[] {
    return tools
      .filter((tool) => tool.modelCallable)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>
      }));
  }

  public async execute(
    context: ToolExecutionContext,
    name: RegisteredToolName,
    rawInput: unknown,
    parentSignal?: AbortSignal
  ): Promise<unknown> {
    return this.executeInternal(context, name, rawInput, parentSignal);
  }

  public async executeModelCallable(
    context: ToolExecutionContext,
    name: string,
    rawInput: unknown,
    parentSignal?: AbortSignal
  ): Promise<unknown> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool || !tool.modelCallable) {
      throw new PolarisError(
        "PERMISSION_DENIED",
        "Polaris no puede ejecutar esta herramienta automáticamente.",
        403
      );
    }

    return this.executeInternal(context, tool.name, rawInput, parentSignal);
  }

  private async executeInternal(
    context: ToolExecutionContext,
    name: RegisteredToolName,
    rawInput: unknown,
    parentSignal?: AbortSignal
  ): Promise<unknown> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      throw new PolarisError("NOT_FOUND", "La herramienta solicitada no existe.", 404);
    }

    const input = tool.inputSchema.parse(rawInput);
    let timeoutTriggered = false;
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();

    if (parentSignal?.aborted) {
      controller.abort();
    } else {
      parentSignal?.addEventListener("abort", onParentAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, tool.timeoutMs);

    const abortPromise = new Promise<never>((_, reject) => {
      const rejectAborted = () => {
        reject(
          timeoutTriggered
            ? new PolarisError("TIMEOUT", "La herramienta excedió el tiempo permitido.", 504)
            : new PolarisError("TIMEOUT", "La herramienta fue cancelada.", 499)
        );
      };

      if (controller.signal.aborted) {
        rejectAborted();
        return;
      }

      controller.signal.addEventListener("abort", rejectAborted, { once: true });
    });

    try {
      return await Promise.race([
        tool.execute(context, input as never, controller.signal),
        abortPromise
      ]);
    } finally {
      clearTimeout(timeoutId);
      parentSignal?.removeEventListener("abort", onParentAbort);
    }
  }
}
