import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { ApiProblem, Capabilities, ServerSentEventName } from "@polaris/contracts";
import { authenticateRequest, type AuthenticatedContext } from "./auth.js";
import { createAIProvider } from "./core/ai/providerFactory.js";
import type { AIProvider } from "./core/ai/types.js";
import { ConversationEngine } from "./core/conversation/conversationEngine.js";
import { ToolEngine, type RegisteredToolName } from "./core/tools/toolEngine.js";
import { hasSupabaseConfiguration, loadConfig, type PolarisConfig } from "./config.js";
import {
  createConversation,
  createMessage,
  createMemory,
  deleteConversation,
  deleteMemory,
  getConversation,
  getPreferences,
  getProfile,
  listConversations,
  listDevices,
  listMemories,
  listMessages,
  registerDevice,
  updateConversationTitle,
  updateMemory,
  updateMessage,
  updatePreferences,
  updateProfile
} from "./data/polarisRepository.js";
import { asPolarisError, PolarisError } from "./errors.js";
import {
  chatRequestSchema,
  createConversationSchema,
  createMemorySchema,
  identifierSchema,
  registerDeviceSchema,
  toolInvocationSchema,
  updateConversationSchema,
  updateMemorySchema,
  updatePreferencesSchema,
  updateProfileSchema
} from "./schemas.js";

type AppDependencies = {
  config?: PolarisConfig;
  provider?: AIProvider;
};

function requestId(request: FastifyRequest): string {
  return request.id || crypto.randomUUID();
}

function toProblem(error: PolarisError, id: string): { error: ApiProblem } {
  return {
    error: {
      code: error.code,
      message: error.expose ? error.message : "Polaris no pudo completar la operación.",
      requestId: id
    }
  };
}

async function contextFor(
  request: FastifyRequest,
  config: PolarisConfig
): Promise<AuthenticatedContext> {
  return authenticateRequest(request.headers.authorization, config);
}

function safeTitle(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  return collapsed.length > 72 ? `${collapsed.slice(0, 69)}…` : collapsed;
}

function writeSse(
  response: ServerResponse<IncomingMessage>,
  event: ServerSentEventName,
  data: Record<string, unknown>
): void {
  if (response.writableEnded || response.destroyed) return;
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const config = dependencies.config ?? loadConfig();
  const provider = dependencies.provider ?? createAIProvider(config);
  const tools = new ToolEngine();
  const conversations = new ConversationEngine(provider, tools);
  const app = Fastify({
    logger: config.nodeEnv === "production"
      ? { level: "info", redact: ["req.headers.authorization", "req.headers.cookie"] }
      : false,
    genReqId: (request) => request.headers["x-request-id"]?.toString() || crypto.randomUUID()
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Polaris-Client", "X-Request-Id"],
    maxAge: 86_400
  });

  await app.register(rateLimit, {
    global: true,
    max: config.requestRateLimitMax,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: "RATE_LIMIT",
        message: `Demasiadas solicitudes. Intenta de nuevo en ${context.after}.`
      }
    })
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", requestId(request));
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cache-control", "no-store");
  });

  app.setErrorHandler((error, request, reply) => {
    const isZodError = error instanceof Error && error.name === "ZodError";
    const mapped = error instanceof PolarisError
      ? error
      : isZodError
        ? new PolarisError("VALIDATION_ERROR", "La solicitud contiene datos inválidos.", 400, { cause: error })
        : asPolarisError(error);
    void reply.status(mapped.statusCode).send(toProblem(mapped, requestId(request)));
  });

  app.get("/v1/health", async () => ({
    backend: "ok",
    database: hasSupabaseConfiguration(config) ? "configured" : "unconfigured",
    provider: provider.available ? "configured" : "unconfigured",
    version: "0.1.0"
  }));

  app.get("/v1/capabilities", async (): Promise<Capabilities> => ({
    chat: provider.available && hasSupabaseConfiguration(config),
    streaming: provider.available && hasSupabaseConfiguration(config),
    memory: hasSupabaseConfiguration(config),
    voice: false,
    vision: false,
    robot: false,
    webSearch: false,
    desktopTools: false,
    calendar: false
  }));

  app.get("/v1/profile", async (request) => {
    const context = await contextFor(request, config);
    return getProfile(context);
  });

  app.patch("/v1/profile", async (request) => {
    const context = await contextFor(request, config);
    const body = updateProfileSchema.parse(request.body);
    return updateProfile(context, {
      ...(body.display_name !== undefined ? { display_name: body.display_name } : {}),
      ...(body.avatar_url !== undefined ? { avatar_url: body.avatar_url } : {}),
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {})
    });
  });

  app.get("/v1/conversations", async (request) => {
    const context = await contextFor(request, config);
    return listConversations(context);
  });

  app.post("/v1/conversations", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = createConversationSchema.parse(request.body);
    const conversation = await createConversation(context, body.title);
    return reply.status(201).send(conversation);
  });

  app.get("/v1/conversations/:id", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    return getConversation(context, id);
  });

  app.patch("/v1/conversations/:id", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    const body = updateConversationSchema.parse(request.body);
    return updateConversationTitle(context, id, body.title);
  });

  app.delete("/v1/conversations/:id", async (request, reply) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    await deleteConversation(context, id);
    return reply.status(204).send();
  });

  app.get("/v1/conversations/:id/messages", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    return listMessages(context, id);
  });

  app.get("/v1/memories", async (request) => {
    const context = await contextFor(request, config);
    const query = (request.query as { q?: unknown }).q;
    const q = typeof query === "string" ? query.slice(0, 180) : undefined;
    return listMemories(context, q);
  });

  app.post("/v1/memories", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = createMemorySchema.parse(request.body);
    const memory = await createMemory(context, body);
    return reply.status(201).send(memory);
  });

  app.patch("/v1/memories/:id", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    const body = updateMemorySchema.parse(request.body);
    return updateMemory(context, id, {
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.importance !== undefined ? { importance: body.importance } : {})
    });
  });

  app.delete("/v1/memories/:id", async (request, reply) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    await deleteMemory(context, id);
    return reply.status(204).send();
  });

  app.get("/v1/preferences", async (request) => {
    const context = await contextFor(request, config);
    return getPreferences(context);
  });

  app.patch("/v1/preferences", async (request) => {
    const context = await contextFor(request, config);
    const body = updatePreferencesSchema.parse(request.body);
    return updatePreferences(context, {
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.theme !== undefined ? { theme: body.theme } : {}),
      ...(body.tone !== undefined ? { tone: body.tone } : {}),
      ...(body.response_style !== undefined ? { response_style: body.response_style } : {}),
      ...(body.voice_settings !== undefined ? { voice_settings: body.voice_settings } : {}),
      ...(body.notifications !== undefined ? { notifications: body.notifications } : {}),
      ...(body.privacy_settings !== undefined ? { privacy_settings: body.privacy_settings } : {})
    });
  });

  app.get("/v1/devices", async (request) => {
    const context = await contextFor(request, config);
    return listDevices(context);
  });

  app.post("/v1/devices", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = registerDeviceSchema.parse(request.body);
    const device = await registerDevice(context, body);
    return reply.status(201).send(device);
  });

  app.post("/v1/tools/:name", async (request) => {
    const context = await contextFor(request, config);
    const name = (request.params as { name?: unknown }).name;
    if (typeof name !== "string") {
      throw new PolarisError("NOT_FOUND", "La herramienta solicitada no existe.", 404);
    }
    const body = toolInvocationSchema.parse(request.body);
    const result = await tools.execute(context, name as RegisteredToolName, body.input);
    return { name, result };
  });

  app.post("/v1/chat", async (request) => {
    const context = await contextFor(request, config);
    const body = chatRequestSchema.parse(request.body);
    const message = body.content ?? body.message;
    if (!message) throw new PolarisError("VALIDATION_ERROR", "Se requiere un mensaje.", 400);

    const conversation = body.conversationId
      ? await getConversation(context, body.conversationId)
      : await createConversation(context, safeTitle(message));

    const userMessage = await createMessage(context, {
      conversationId: conversation.id,
      role: "user",
      content: message
    });

    const assistantMessage = await createMessage(context, {
      conversationId: conversation.id,
      role: "assistant",
      content: "",
      status: "streaming"
    });

    if (!provider.available) {
      await updateMessage(context, assistantMessage.id, {
        status: "failed",
        metadata: { reason: "provider_unconfigured" }
      }).catch(() => undefined);
      throw new PolarisError(
        "PROVIDER_ERROR",
        "La IA no está configurada en el servidor.",
        503
      );
    }

    let assistantContent = "";
    let providerResponseId: string | undefined;
    const requestAbortController = new AbortController();
    const onRequestClose = () => requestAbortController.abort();
    request.raw.once("close", onRequestClose);

    try {
      for await (const event of conversations.stream(context, {
        conversationId: conversation.id,
        message,
        signal: requestAbortController.signal
      })) {
        if (event.type === "message.delta") assistantContent += event.delta;
        if (event.type === "message.done") providerResponseId = event.providerResponseId;
      }

      await updateMessage(context, assistantMessage.id, {
        content: assistantContent,
        status: "completed",
        metadata: providerResponseId ? { providerResponseId } : {}
      });
    } catch (error) {
      await updateMessage(context, assistantMessage.id, {
        content: assistantContent,
        status: requestAbortController.signal.aborted ? "cancelled" : "failed"
      }).catch(() => undefined);
      throw error;
    } finally {
      request.raw.off("close", onRequestClose);
    }

    return {
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      content: assistantContent
    };
  });

  app.post("/v1/chat/stream", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = chatRequestSchema.parse(request.body);
    const message = body.content ?? body.message;
    if (!message) throw new PolarisError("VALIDATION_ERROR", "Se requiere un mensaje.", 400);

    const conversation = body.conversationId
      ? await getConversation(context, body.conversationId)
      : await createConversation(context, safeTitle(message));

    const userMessage = await createMessage(context, {
      conversationId: conversation.id,
      role: "user",
      content: message
    });

    if (!provider.available) {
      throw new PolarisError(
        "PROVIDER_ERROR",
        "La IA no está configurada en el servidor. El mensaje se conservó en el historial, pero no se generó una respuesta.",
        503
      );
    }

    const assistantMessage = await createMessage(context, {
      conversationId: conversation.id,
      role: "assistant",
      content: "",
      status: "streaming"
    });

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      "x-request-id": requestId(request)
    });
    reply.raw.write(": Polaris stream\n\n");

    const controller = new AbortController();
    const abortOnDisconnect = () => controller.abort();
    request.raw.once("close", abortOnDisconnect);
    let assistantContent = "";
    let failed = false;

    try {
      writeSse(reply.raw, "message.accepted", {
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id
      });

      for await (const event of conversations.stream(context, {
        conversationId: conversation.id,
        message,
        signal: controller.signal
      })) {
        if (event.type === "message.delta") {
          assistantContent += event.delta;
          writeSse(reply.raw, event.type, { delta: event.delta });
        } else if (event.type === "tool.started") {
          writeSse(reply.raw, event.type, { name: event.name });
        } else if (event.type === "tool.completed") {
          writeSse(reply.raw, event.type, { name: event.name, result: event.result });
        } else {
          writeSse(reply.raw, event.type, {
            messageId: assistantMessage.id,
            ...(event.providerResponseId ? { providerResponseId: event.providerResponseId } : {})
          });
        }
      }

      await updateMessage(context, assistantMessage.id, {
        content: assistantContent,
        status: "completed"
      });
    } catch (error) {
      failed = true;
      const mapped = asPolarisError(error);
      await updateMessage(context, assistantMessage.id, {
        content: assistantContent,
        status: controller.signal.aborted ? "cancelled" : "failed"
      }).catch(() => undefined);
      writeSse(reply.raw, "error", {
        code: mapped.code,
        message: mapped.expose ? mapped.message : "La respuesta no pudo completarse.",
        requestId: requestId(request)
      });
    } finally {
      request.raw.removeListener("close", abortOnDisconnect);
      if (!reply.raw.writableEnded) reply.raw.end();
      if (failed && !controller.signal.aborted) {
        app.log.warn({ requestId: requestId(request) }, "Polaris stream ended with a controlled failure");
      }
    }
  });

  return app;
}
