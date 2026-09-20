import { z } from "zod";
import { calculateExpression } from "./calculator.js";
import {
  createMemory,
  listConversations,
  listRelevantMemories
} from "../../data/polarisRepository.js";
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
  execute(context: ToolExecutionContext, input: z.infer<TInput>): Promise<TResult>;
}

const getTimeSchema = z.object({
  timezone: z.string().trim().min(1).max(100).default("America/Lima")
});
const calculatorSchema = z.object({ expression: z.string().trim().min(1).max(200) });
const saveMemorySchema = z.object({
  content: z.string().trim().min(1).max(10_000),
  category: z
    .enum(["PERSONAL", "PREFERENCE", "PROJECT", "CONTEXT", "FACT", "GOAL"])
    .default("CONTEXT"),
  importance: z.number().int().min(1).max(5).default(3)
});
const searchMemorySchema = z.object({ query: z.string().trim().max(180).default("") });
const listConversationsSchema = z.object({});

const tools = [
  {
    name: "get_time",
    description: "Obtiene la fecha y hora actual de una zona horaria IANA.",
    category: "INFORMATION",
    riskLevel: "LOW",
    timeoutMs: 1_000,
    modelCallable: true,
    inputSchema: getTimeSchema,
    async execute(_context, input) {
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
    async execute(_context, input) {
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
    async execute(context, input) {
      const memory = await createMemory(context, {
        content: input.content,
        category: input.category,
        importance: input.importance,
        source: "tool"
      });
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
    async execute(context, input) {
      const memories = await listRelevantMemories(context, input.query, 8);
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
    async execute(context) {
      const conversations = await listConversations(context);
      return conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updated_at
      }));
    }
  }
] as const satisfies readonly ToolDefinition<z.ZodType, unknown>[];

export type RegisteredToolName = (typeof tools)[number]["name"];

export class ToolEngine {
  public list(): readonly ToolDefinition<z.ZodType, unknown>[] {
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
    rawInput: unknown
  ): Promise<unknown> {
    return this.executeInternal(context, name, rawInput);
  }

  public async executeModelCallable(
    context: ToolExecutionContext,
    name: string,
    rawInput: unknown
  ): Promise<unknown> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool || !tool.modelCallable) {
      throw new PolarisError(
        "PERMISSION_DENIED",
        "Polaris no puede ejecutar esta herramienta automáticamente.",
        403
      );
    }

    return this.executeInternal(context, tool.name, rawInput);
  }

  private async executeInternal(
    context: ToolExecutionContext,
    name: RegisteredToolName,
    rawInput: unknown
  ): Promise<unknown> {
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) {
      throw new PolarisError("NOT_FOUND", "La herramienta solicitada no existe.", 404);
    }

    const input = tool.inputSchema.parse(rawInput);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), tool.timeoutMs);

    try {
      return await Promise.race([
        tool.execute(context, input as never),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new PolarisError("TIMEOUT", "La herramienta excedió el tiempo permitido.", 504)),
            { once: true }
          );
        })
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
