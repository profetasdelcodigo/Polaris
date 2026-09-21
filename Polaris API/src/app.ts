import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type { ApiProblem, Capabilities, DeviceType, ServerSentEventName } from "@polaris/contracts";
import { authenticateRequest, type AuthenticatedContext } from "./auth.js";
import { createAIProvider } from "./core/ai/providerFactory.js";
import type { AIProvider } from "./core/ai/types.js";
import { ConversationEngine } from "./core/conversation/conversationEngine.js";
import { ToolEngine, type RegisteredToolName } from "./core/tools/toolEngine.js";
import { capabilityRegistry, routeCapabilities } from "./core/capabilities/capabilityRegistry.js";
import { planUniversalTask, universalCatalogStats } from "./core/automation/universalTaskRouter.js";
import { listSkillCatalog, skillCatalogCapacity, skillCatalogCapacityByDevice } from "./core/skills/skillCatalog.js";
import { skillFingerprint, validateSkillProgram } from "./core/skills/skillRuntime.js";
import { composeSkillFromIntent, skillComposerCatalog } from "./core/skills/skillComposer.js";
import {
  claimRelayCommand,
  createRelayCommand,
  listPendingRelayCommands,
  updateRelayCommand
} from "./core/relay/deviceCommandRepository.js";
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
    version: "0.2.0"
  }));

  app.get("/v1/capabilities", async (): Promise<Capabilities> => {
    const matrix = Object.fromEntries(
      (["WEB", "ANDROID", "DESKTOP", "ROBOT"] as const).map((device) => [
        device,
        capabilityRegistry.some((capability) => capability.availability[device] === "AVAILABLE")
          ? "AVAILABLE"
          : capabilityRegistry.some((capability) => capability.availability[device] === "PERMISSION_REQUIRED")
            ? "PERMISSION_REQUIRED"
            : "NOT_IMPLEMENTED"
      ])
    ) as Capabilities["deviceMatrix"];

    return {
      chat: provider.available && hasSupabaseConfiguration(config),
      streaming: provider.available && hasSupabaseConfiguration(config),
      memory: hasSupabaseConfiguration(config),
      voice: true,
      vision: false,
      robot: false,
      webSearch: false,
      desktopTools: false,
      calendar: false,
      relay: hasSupabaseConfiguration(config),
      registryVersion: "capabilities-v1",
      deviceMatrix: matrix,
      capabilities: capabilityRegistry
    };
  });

  app.get("/v1/automation/catalog", async () => ({
    registryVersion: "universal-automation-v1",
    ...universalCatalogStats()
  }));

  app.post("/v1/automation/plan", async (request) => {
    await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      preferredDevice?: unknown;
      allowRemote?: unknown;
      requireVerification?: unknown;
      maxSteps?: unknown;
    };

    const preferred = typeof body.preferredDevice === "string"
      ? body.preferredDevice.toUpperCase()
      : undefined;

    if (
      preferred !== undefined &&
      !["WEB", "ANDROID", "DESKTOP", "ROBOT"].includes(preferred)
    ) {
      throw new PolarisError("VALIDATION_ERROR", "preferredDevice no es válido.", 400);
    }

    const plan = planUniversalTask({
      task: typeof body.task === "string" ? body.task.trim() : "",
      ...(preferred ? { preferredDevice: preferred as DeviceType } : {}),
      allowRemote: body.allowRemote !== false,
      requireVerification: body.requireVerification !== false,
      maxSteps: typeof body.maxSteps === "number" ? body.maxSteps : undefined
    });

    return plan;
  });

  app.get("/v1/skills/catalog", async (request) => {
    await contextFor(request, config);
    return skillComposerCatalog();
  });

  app.post("/v1/skills/compose", async (request) => {
    await contextFor(request, config);
    const body = request.body as { task?: unknown };
    if (typeof body?.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    return {
      valid: true,
      generated: true,
      runtime: "polaris-skill-v1",
      program: composeSkillFromIntent(body.task)
    };
  });

  app.post("/v1/skills/execute", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      targetDeviceId?: unknown;
      preferredDevice?: unknown;
      requireConfirmation?: unknown;
    };

    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }

    const requestedDevice = typeof body.preferredDevice === "string"
      ? body.preferredDevice.toUpperCase()
      : undefined;
    if (requestedDevice && !["WEB", "ANDROID", "DESKTOP"].includes(requestedDevice)) {
      throw new PolarisError("VALIDATION_ERROR", "preferredDevice no es válido.", 400);
    }

    const devices = await listDevices(context);
    const target = typeof body.targetDeviceId === "string"
      ? devices.find((device) => device.id === body.targetDeviceId)
      : devices.find((device) =>
          device.status === "ONLINE" &&
          (!requestedDevice || device.type === requestedDevice)
        );

    if (!target) {
      throw new PolarisError(
        "NOT_FOUND",
        "No encontré un dispositivo Polaris conectado compatible con esta Skill.",
        404
      );
    }

    const program = composeSkillFromIntent(body.task);
    const fingerprint = skillFingerprint(program);
    const action = target.type === "ANDROID"
      ? "android.run_skill"
      : target.type === "WEB"
        ? "web.run_skill"
        : "desktop.run_skill";

    const command = await createRelayCommand(context, {
      targetDeviceId: target.id,
      capabilityId: target.type === "ANDROID" ? "automation.skill_v1" : "desktop.skill_v1",
      action,
      payload: {
        program,
        task: body.task.trim(),
        fingerprint
      },
      requiresConfirmation: body.requireConfirmation !== false,
      ttlSeconds: 120
    });

    return reply.status(201).send({
      queued: true,
      runtime: "polaris-skill-v1",
      fingerprint,
      target: {
        id: target.id,
        name: target.name,
        type: target.type,
        status: target.status
      },
      command
    });
  });

  app.post("/v1/skills/validate", async (request) => {
    await contextFor(request, config);
    const program = validateSkillProgram(request.body);
    return {
      valid: true,
      runtime: "polaris-skill-v1",
      limits: { maxSteps: 12, maxWaitMs: 10_000, maxSerializedBytes: 32_000 },
      program,
      fingerprint: skillFingerprint(program)
    };
  });

  app.get("/v1/skills", async (request) => {
    const query = request.query as { device?: unknown; status?: unknown; q?: unknown };
    const device = typeof query.device === "string"
      ? (query.device.toUpperCase() as DeviceType)
      : undefined;
    const status = typeof query.status === "string"
      ? query.status.toUpperCase()
      : undefined;
    const search = typeof query.q === "string" ? query.q.trim().toLocaleLowerCase("es-PE") : "";

    const skills = listSkillCatalog().filter((skill) => {
      if (device && !skill.supportedDevices.includes(device)) return false;
      if (status && skill.status !== status) return false;
      if (search && !`${skill.id} ${skill.name} ${skill.description}`.toLocaleLowerCase("es-PE").includes(search)) {
        return false;
      }
      return true;
    });

    return {
      registryVersion: "skills-v1",
      catalogCapacity: skillCatalogCapacity,
      catalogCapacityByDevice: skillCatalogCapacityByDevice,
      returned: skills.length,
      implemented: skills.filter((skill) => skill.status === "AVAILABLE").length,
      partial: skills.filter((skill) => skill.status === "PARTIAL").length,
      planned: skills.filter((skill) => skill.status === "PLANNED").length,
      skills
    };
  });

  app.post("/v1/capabilities/route", async (request) => {
    await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      preferredDevice?: unknown;
      requiredCapabilities?: unknown;
      allowRemote?: unknown;
    };

    const requiredCapabilities = Array.isArray(body.requiredCapabilities)
      ? body.requiredCapabilities.filter((value): value is string => typeof value === "string")
      : undefined;

    return routeCapabilities({
      task: typeof body.task === "string" ? body.task : "tarea sin descripción",
      preferredDevice: typeof body.preferredDevice === "string"
        ? (body.preferredDevice.toUpperCase() as DeviceType)
        : undefined,
      requiredCapabilities,
      allowRemote: body.allowRemote !== false
    });
  });

  app.post("/v1/relay/commands", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = request.body as Record<string, unknown>;
    if (typeof body.targetDeviceId !== "string" ||
        typeof body.capabilityId !== "string" ||
        typeof body.action !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "Se requiere targetDeviceId, capabilityId y action.", 400);
    }

    const payload = body.payload;
    if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
      throw new PolarisError("VALIDATION_ERROR", "payload debe ser un objeto JSON.", 400);
    }

    const command = await createRelayCommand(context, {
      targetDeviceId: identifierSchema.parse(body.targetDeviceId),
      sourceDeviceId: body.sourceDeviceId === undefined ? undefined : identifierSchema.parse(body.sourceDeviceId),
      capabilityId: body.capabilityId.slice(0, 160),
      action: body.action.slice(0, 160),
      payload: payload as Record<string, unknown> | undefined,
      requiresConfirmation: body.requiresConfirmation !== false,
      ttlSeconds: typeof body.ttlSeconds === "number" ? body.ttlSeconds : undefined
    });

    return reply.status(201).send(command);
  });

  app.get("/v1/relay/commands", async (request) => {
    const context = await contextFor(request, config);
    const query = request.query as { targetDeviceId?: unknown; limit?: unknown };
    if (typeof query.targetDeviceId !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "targetDeviceId es obligatorio.", 400);
    }
    const limit = typeof query.limit === "string" ? Number(query.limit) : 20;
    return listPendingRelayCommands(
      context,
      identifierSchema.parse(query.targetDeviceId),
      Number.isFinite(limit) ? limit : 20
    );
  });

  app.post("/v1/relay/commands/:id/claim", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    const body = request.body as { targetDeviceId?: unknown };
    if (typeof body.targetDeviceId !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "targetDeviceId es obligatorio.", 400);
    }
    return claimRelayCommand(context, id, identifierSchema.parse(body.targetDeviceId));
  });

  app.patch("/v1/relay/commands/:id", async (request) => {
    const context = await contextFor(request, config);
    const id = identifierSchema.parse((request.params as { id?: unknown }).id);
    const body = request.body as Record<string, unknown>;
    const allowed = ["PENDING", "CLAIMED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"] as const;
    if (typeof body.status !== "string" || !allowed.includes(body.status as (typeof allowed)[number])) {
      throw new PolarisError("VALIDATION_ERROR", "Estado de orden no válido.", 400);
    }

    const result = body.result;
    if (result !== undefined && (typeof result !== "object" || result === null || Array.isArray(result))) {
      throw new PolarisError("VALIDATION_ERROR", "result debe ser un objeto JSON.", 400);
    }

    return updateRelayCommand(context, id, {
      status: body.status as never,
      result: result as Record<string, unknown> | undefined,
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 2000) : null
    });
  });

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
        currentMessageId: userMessage.id,
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
        "La IA no está configurada en el servidor. El mensaje se conservó en el historial, pero no se generó una respuesta.",
        503
      );
    }

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
        currentMessageId: userMessage.id,
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
