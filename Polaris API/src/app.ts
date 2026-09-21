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
import { buildPersonalityProfile, extractMemoryCandidates, summarizeAdaptiveContext } from "./core/context/adaptiveContext.js";
import { planAgentTask } from "./core/planning/agentPlanner.js";
import { createExecutionTrace } from "./core/execution/executionTrace.js";
import { recoveryPolicy } from "./core/recovery/recoveryPolicy.js";
import { evaluateConsent } from "./core/security/consentPolicy.js";
import { createTaskState, updateTaskState, checkpointTask, cancelTask } from "./core/tasks/taskState.js";
import { assessDeviceHealth } from "./core/devices/deviceHealth.js";
import { rankMemories } from "./core/memory/memoryScorer.js";
import { createEvent, PolarisEventBus } from "./core/events/polarisEventBus.js";
import { routeNotification } from "./core/notifications/notificationRouter.js";
import { evaluateAutomationPolicy } from "./core/automation/automationPolicy.js";
import { createBrowserContext, browserContextSummary } from "./core/browser/browserContext.js";
import { inspectPromptBoundary } from "./core/security/promptBoundary.js";
import { classifyIntent } from "./core/intent/intentClassifier.js";
import { createLatencyBudget } from "./core/performance/latencyBudget.js";
import { createContinuityCapsule, validateContinuityCapsule } from "./core/continuity/continuityCapsule.js";
import { planDeepResearch } from "./core/research/deepResearchPlanner.js";
import { createRoutine, routinePreview } from "./core/routines/routineEngine.js";
import { featureRegistrySummary, polarisFeatureRegistry } from "./core/features/featureRegistry.js";
import { createOfflineQueueItem, offlineQueuePreview, nextQueueState, type OfflineQueueItem } from "./core/automation/offlineQueue.js";
import { planBrowserAgent, browserAgentPreview } from "./core/browser/browserAgent.js";
import { chooseHandoffTarget, handoffEnvelope, type HandoffDevice } from "./core/multiplatform/handoffPlanner.js";
import { compileBoundedMacro } from "./core/skills/skillMacro.js";
import { repairSkillFailure } from "./core/recovery/skillRepair.js";
import { compileDeviceCommand, type DeviceCommandEnvelope } from "./core/devices/deviceCommandCompiler.js";
import { parseDeviceIntent } from "./core/devices/deviceIntentParser.js";
import { resolveDeviceReference } from "./core/devices/deviceResolver.js";
import { compileScene } from "./core/automation/sceneEngine.js";
import { designSkill } from "./core/skills/skillStudio.js";
import { buildExperienceBrief } from "./core/experience/experienceEngine.js";
import { buildPersonaProfile } from "./core/personality/personaEngine.js";
import { buildMemoryLifecycleReport } from "./core/memory/memoryLifecycle.js";
import { buildVisualScene } from "./core/visuals/visualDirector.js";
import { suggestNextActions } from "./core/agent/proactiveSuggestions.js";
import { discoverableProtocolMatrix, deviceActions, deviceFamilies, deviceProtocols, type DeviceAction, type DeviceFamily, type DeviceProtocol, type SmartDevice } from "./core/devices/deviceFabric.js";
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
  const eventBus = new PolarisEventBus();
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

  app.get("/v1/features", async () => ({
    registryVersion: "adaptive-features-v1",
    ...featureRegistrySummary(),
    features: polarisFeatureRegistry
  }));

  app.post("/v1/agent/plan", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      preferredDevice?: unknown;
      preferredMode?: unknown;
      requireVerification?: unknown;
    };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    const boundary = inspectPromptBoundary(body.task);
    const intent = classifyIntent(body.task);
    if (!boundary.safe && intent.intent !== "CHAT") {
      throw new PolarisError("PERMISSION_DENIED", "La entrada contiene instrucciones que no pueden convertirse automáticamente en una acción privilegiada.", 403);
    }

    const plan = planAgentTask({
      task: boundary.sanitized,
      ...(typeof body.preferredDevice === "string"
        ? { preferredDevice: body.preferredDevice.toUpperCase() as DeviceType }
        : {}),
      ...(typeof body.preferredMode === "string" ? { preferredMode: body.preferredMode } : {}),
      requireVerification: body.requireVerification !== false
    });
    return {
      ...plan,
      intent,
      latencyBudget: createLatencyBudget(plan.mode)
    };
  });

  app.post("/v1/context/adaptive", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      preferredMode?: unknown;
    };
    const task = typeof body.task === "string" ? body.task.trim().slice(0, 4_000) : "";
    const profile = await getProfile(context);
    const preferences = await getPreferences(context);
    const memories = await listMemories(context, task || undefined);
    const devices = await listDevices(context);
    const personality = buildPersonalityProfile(
      task,
      {
        tone: typeof preferences.tone === "string" ? preferences.tone : null,
        response_style: typeof preferences.response_style === "string" ? preferences.response_style : null
      },
      typeof body.preferredMode === "string" ? body.preferredMode : null
    );
    const summary = summarizeAdaptiveContext({ profile, preferences, memories, devices, personality });
    return {
      profile,
      preferences,
      memories,
      devices,
      personality,
      summary
    };
  });

  app.post("/v1/memory/candidates", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      message?: unknown;
      persist?: unknown;
    };
    if (typeof body.message !== "string" || !body.message.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "message es obligatorio.", 400);
    }

    const candidates = extractMemoryCandidates(body.message);
    if (body.persist !== true || candidates.length === 0) {
      return {
        persisted: false,
        requiresExplicitPersist: true,
        candidates
      };
    }

    const persisted = [];
    for (const candidate of candidates) {
      persisted.push(await createMemory(context, {
        category: candidate.category,
        content: candidate.content,
        importance: candidate.importance,
        source: "user",
        metadata: { reason: candidate.reason, adaptiveMemory: true }
      }));
    }

    return reply.status(201).send({
      persisted: true,
      candidates,
      memories: persisted
    });
  });

  app.post("/v1/research/plan", async (request) => {
    await contextFor(request, config);
    const body = request.body as { question?: unknown };
    if (typeof body.question !== "string" || !body.question.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "question es obligatorio.", 400);
    }
    return planDeepResearch(body.question);
  });

  app.post("/v1/continuity/capsule", async (request) => {
    await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      conversationId?: unknown;
      sourceDevice?: unknown;
      targetDevice?: unknown;
      state?: unknown;
      pendingSkills?: unknown;
      ttlSeconds?: unknown;
    };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    const state = body.state && typeof body.state === "object" && !Array.isArray(body.state)
      ? body.state as Record<string, unknown>
      : {};
    const pendingSkills = Array.isArray(body.pendingSkills)
      ? body.pendingSkills.filter((value): value is string => typeof value === "string").slice(0, 20)
      : [];

    return createContinuityCapsule({
      task: body.task,
      ...(typeof body.conversationId === "string" ? { conversationId: body.conversationId } : {}),
      ...(typeof body.sourceDevice === "string" ? { sourceDevice: body.sourceDevice.toUpperCase() as DeviceType } : {}),
      ...(typeof body.targetDevice === "string" ? { targetDevice: body.targetDevice.toUpperCase() as DeviceType } : {}),
      state,
      pendingSkills,
      ...(typeof body.ttlSeconds === "number" ? { ttlSeconds: body.ttlSeconds } : {})
    });
  });

  app.post("/v1/continuity/validate", async (request) => {
    await contextFor(request, config);
    return validateContinuityCapsule(request.body);
  });

  app.post("/v1/routines/preview", async (request) => {
    await contextFor(request, config);
    const routine = createRoutine(request.body);
    return routinePreview(routine);
  });

  app.post("/v1/security/consent", async (request) => {
    await contextFor(request, config);
    const body = request.body as { risk?: unknown; explicitUserApproval?: unknown; sessionApproved?: unknown; capabilityTrusted?: unknown };
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(body.risk))) {
      throw new PolarisError("VALIDATION_ERROR", "risk no es válido.", 400);
    }
    return evaluateConsent({
      risk: body.risk as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      explicitUserApproval: body.explicitUserApproval === true,
      sessionApproved: body.sessionApproved === true,
      capabilityTrusted: body.capabilityTrusted === true
    });
  });

  app.post("/v1/tasks/create", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { objective?: unknown };
    if (typeof body.objective !== "string" || !body.objective.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "objective es obligatorio.", 400);
    }
    const task = createTaskState(body.objective);
    await eventBus.emit(createEvent("TASK_CREATED", { taskId: task.taskId, objective: task.objective }, context.user.id, "api"));
    return task;
  });

  app.post("/v1/tasks/transition", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      status?: unknown;
      progress?: unknown;
      currentStep?: unknown;
      error?: unknown;
      checkpoint?: unknown;
      checkpointState?: unknown;
      cancel?: unknown;
    };
    if (!body.task || typeof body.task !== "object") {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    let task = body.task as ReturnType<typeof createTaskState>;
    if (body.cancel === true) task = cancelTask(task);
    else {
      task = updateTaskState(task, {
        status: ["QUEUED","RUNNING","PAUSED","WAITING_USER","SUCCEEDED","FAILED","CANCELLED"].includes(String(body.status))
          ? body.status as ReturnType<typeof updateTaskState>["status"] : undefined,
        progress: typeof body.progress === "number" ? body.progress : undefined,
        currentStep: typeof body.currentStep === "string" ? body.currentStep : undefined,
        error: typeof body.error === "string" ? body.error : undefined
      });
      if (typeof body.checkpoint === "string") {
        const state = body.checkpointState && typeof body.checkpointState === "object" && !Array.isArray(body.checkpointState)
          ? body.checkpointState as Record<string, unknown> : {};
        task = checkpointTask(task, body.checkpoint, state);
      }
    }
    await eventBus.emit(createEvent("TASK_UPDATED", { taskId: task.taskId, status: task.status, progress: task.progress }, context.user.id, "api"));
    return task;
  });

  app.post("/v1/devices/health", async (request) => {
    await contextFor(request, config);
    const body = request.body as { deviceId?: unknown; type?: unknown; status?: unknown; lastSeen?: unknown; latencyMs?: unknown };
    if (typeof body.deviceId !== "string" || typeof body.type !== "string" || typeof body.status !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "deviceId, type y status son obligatorios.", 400);
    }
    return assessDeviceHealth({
      deviceId: body.deviceId,
      type: body.type as DeviceType,
      status: body.status,
      lastSeen: typeof body.lastSeen === "string" ? body.lastSeen : null,
      latencyMs: typeof body.latencyMs === "number" ? body.latencyMs : null
    });
  });

  app.post("/v1/memory/rank", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { query?: unknown };
    if (typeof body.query !== "string") throw new PolarisError("VALIDATION_ERROR", "query es obligatorio.", 400);
    const memories = await listMemories(context, body.query);
    return rankMemories(body.query, memories);
  });

  app.post("/v1/notifications/preview", async (request) => {
    await contextFor(request, config);
    const body = request.body as { title?: unknown; body?: unknown; channel?: unknown; urgent?: unknown; action?: unknown };
    if (typeof body.title !== "string" || typeof body.body !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "title y body son obligatorios.", 400);
    }
    return routeNotification({
      title: body.title,
      body: body.body,
      preferredChannel: typeof body.channel === "string" ? body.channel as "IN_APP" | "WEB" | "ANDROID" | "DESKTOP" : undefined,
      urgent: body.urgent === true,
      action: body.action && typeof body.action === "object" ? body.action as { label: string; intent: string } : undefined
    });
  });

  app.post("/v1/automation/policy", async (request) => {
    await contextFor(request, config);
    const body = request.body as { risk?: unknown; reversible?: unknown; userRequested?: unknown; hasPermission?: unknown; dryRun?: unknown };
    if (!["LOW","MEDIUM","HIGH","CRITICAL"].includes(String(body.risk))) {
      throw new PolarisError("VALIDATION_ERROR", "risk no es válido.", 400);
    }
    return evaluateAutomationPolicy({
      risk: body.risk as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      reversible: body.reversible === true,
      userRequested: body.userRequested === true,
      hasPermission: body.hasPermission === true,
      dryRun: body.dryRun === true
    });
  });

  app.post("/v1/browser/context", async (request) => {
    await contextFor(request, config);
    const body = request.body as { url?: unknown; title?: unknown; selectedText?: unknown; visibleText?: unknown; tabId?: unknown };
    const context = createBrowserContext({
      url: typeof body.url === "string" ? body.url : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      selectedText: typeof body.selectedText === "string" ? body.selectedText : undefined,
      visibleText: typeof body.visibleText === "string" ? body.visibleText : undefined,
      tabId: typeof body.tabId === "string" ? body.tabId : undefined
    });
    return { context, summary: browserContextSummary(context) };
  });

  app.post("/v1/offline-queue/preview", async (request) => {
    await contextFor(request, config);
    const body = request.body as { items?: unknown[] };
    const items = Array.isArray(body.items) ? body.items as OfflineQueueItem[] : [];
    return offlineQueuePreview(items.slice(0, 50));
  });

  app.post("/v1/offline-queue/create", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { task?: unknown; targetDeviceId?: unknown; safeToReplay?: unknown; maxAttempts?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    return createOfflineQueueItem({
      userId: context.user.id,
      task: body.task,
      ...(typeof body.targetDeviceId === "string" ? { targetDeviceId: body.targetDeviceId } : {}),
      ...(typeof body.safeToReplay === "boolean" ? { safeToReplay: body.safeToReplay } : {}),
      ...(typeof body.maxAttempts === "number" ? { maxAttempts: body.maxAttempts } : {})
    });
  });

  app.post("/v1/offline-queue/transition", async (request) => {
    await contextFor(request, config);
    const body = request.body as { item?: unknown; result?: unknown };
    if (!body.item || typeof body.item !== "object" || !["RETRY","SUCCESS","FAIL","CANCEL"].includes(String(body.result))) {
      throw new PolarisError("VALIDATION_ERROR", "item y result válidos son obligatorios.", 400);
    }
    return nextQueueState(body.item as OfflineQueueItem, body.result as "RETRY" | "SUCCESS" | "FAIL" | "CANCEL");
  });

  app.post("/v1/browser/plan", async (request) => {
    await contextFor(request, config);
    const body = request.body as { task?: unknown; context?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    const browserContext = body.context && typeof body.context === "object" && !Array.isArray(body.context)
      ? body.context as Parameters<typeof planBrowserAgent>[1]
      : undefined;
    const plan = planBrowserAgent(body.task, browserContext);
    return { plan, preview: browserAgentPreview(plan) };
  });

  app.post("/v1/handoff/select", async (request) => {
    await contextFor(request, config);
    const body = request.body as { devices?: unknown; capability?: unknown; preferredType?: unknown; task?: unknown; sourceDeviceId?: unknown; continuityToken?: unknown };
    if (!Array.isArray(body.devices) || typeof body.capability !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "devices y capability son obligatorios.", 400);
    }
    const devices = body.devices.slice(0, 20) as HandoffDevice[];
    const target = chooseHandoffTarget(
      devices,
      body.capability,
      typeof body.preferredType === "string" ? body.preferredType as HandoffDevice["type"] : undefined
    );
    return {
      target,
      envelope: handoffEnvelope({
        task: typeof body.task === "string" ? body.task : body.capability,
        targetDevice: target,
        ...(typeof body.sourceDeviceId === "string" ? { sourceDeviceId: body.sourceDeviceId } : {}),
        ...(typeof body.continuityToken === "string" ? { continuityToken: body.continuityToken } : {})
      })
    };
  });

  app.post("/v1/skills/macro", async (request) => {
    await contextFor(request, config);
    const body = request.body as { name?: unknown; steps?: unknown; repeat?: unknown };
    if (typeof body.name !== "string" || !Array.isArray(body.steps)) {
      throw new PolarisError("VALIDATION_ERROR", "name y steps son obligatorios.", 400);
    }
    return compileBoundedMacro({
      name: body.name,
      steps: body.steps as ReturnType<typeof compileBoundedMacro>["steps"],
      ...(typeof body.repeat === "number" ? { repeat: body.repeat } : {})
    });
  });

  app.post("/v1/skills/repair", async (request) => {
    await contextFor(request, config);
    const body = request.body as { program?: unknown; failedStep?: unknown; reason?: unknown };
    if (!body.program || typeof body.program !== "object" || typeof body.failedStep !== "number" || typeof body.reason !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "program, failedStep y reason son obligatorios.", 400);
    }
    return repairSkillFailure(
      body.program as Parameters<typeof repairSkillFailure>[0],
      body.failedStep,
      body.reason
    );
  });

  app.post("/v1/devices/fabric/intent", async (request) => {
    await contextFor(request, config);
    const body = request.body as { text?: unknown };
    if (typeof body.text !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "text es obligatorio.", 400);
    }
    return parseDeviceIntent(body.text);
  });

  app.get("/v1/devices/fabric/protocols", async (request) => {
    await contextFor(request, config);
    return { protocols: discoverableProtocolMatrix(), families: deviceFamilies, actions: deviceActions };
  });

  app.post("/v1/devices/fabric/compile", async (request) => {
    await contextFor(request, config);
    const body = request.body as {
      device?: unknown;
      action?: unknown;
      value?: unknown;
      confirmed?: unknown;
    };
    if (!body.device || typeof body.device !== "object" || typeof body.action !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "device y action son obligatorios.", 400);
    }
    if (!deviceActions.includes(body.action as DeviceAction)) {
      throw new PolarisError("VALIDATION_ERROR", "Acción de dispositivo no soportada.", 400);
    }
    const device = body.device as SmartDevice;
    if (!deviceProtocols.includes(device.protocol as DeviceProtocol) ||
        !deviceFamilies.includes(device.family as DeviceFamily)) {
      throw new PolarisError("VALIDATION_ERROR", "Protocolo o familia de dispositivo no soportado.", 400);
    }
    return compileDeviceCommand({
      device,
      action: body.action as DeviceAction,
      ...(typeof body.value === "string" || typeof body.value === "number" || typeof body.value === "boolean"
        ? { value: body.value }
        : {}),
      confirmed: body.confirmed === true
    });
  });

  app.post("/v1/experience/brief", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      preferredDevice?: unknown;
      preferredMode?: unknown;
      tone?: unknown;
      responseStyle?: unknown;
    };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    return buildExperienceBrief({
      task: body.task,
      ...(typeof body.preferredDevice === "string" ? { preferredDevice: body.preferredDevice.toUpperCase() as DeviceType } : {}),
      ...(typeof body.preferredMode === "string" ? { preferredMode: body.preferredMode } : {}),
      ...(typeof body.tone === "string" ? { tone: body.tone } : {}),
      ...(typeof body.responseStyle === "string" ? { responseStyle: body.responseStyle } : {})
    });
  });

  app.post("/v1/experience/persona", async (request) => {
    await contextFor(request, config);
    const body = request.body as { task?: unknown; preferredMode?: unknown; tone?: unknown; responseStyle?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    return buildPersonaProfile({
      task: body.task,
      ...(typeof body.preferredMode === "string" ? { preferredMode: body.preferredMode } : {}),
      ...(typeof body.tone === "string" ? { tone: body.tone } : {}),
      ...(typeof body.responseStyle === "string" ? { responseStyle: body.responseStyle } : {})
    });
  });

  app.post("/v1/memory/lifecycle", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { candidate?: unknown };
    if (!body.candidate || typeof body.candidate !== "object" || Array.isArray(body.candidate)) {
      throw new PolarisError("VALIDATION_ERROR", "candidate es obligatorio.", 400);
    }
    const candidate = body.candidate as {
      content?: unknown;
      category?: unknown;
      importance?: unknown;
      source?: unknown;
      created_at?: unknown;
      updated_at?: unknown;
    };
    if (typeof candidate.content !== "string" || typeof candidate.category !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "candidate.content y candidate.category son obligatorios.", 400);
    }
    const existing = await listMemories(context);
    return buildMemoryLifecycleReport(
      {
        content: candidate.content,
        category: candidate.category,
        ...(typeof candidate.importance === "number" ? { importance: candidate.importance } : {}),
        ...(typeof candidate.source === "string" ? { source: candidate.source } : {}),
        ...(typeof candidate.created_at === "string" ? { created_at: candidate.created_at } : {}),
        ...(typeof candidate.updated_at === "string" ? { updated_at: candidate.updated_at } : {})
      },
      existing
    );
  });

  app.post("/v1/devices/resolve", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { query?: unknown };
    if (typeof body.query !== "string" || !body.query.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "query es obligatorio.", 400);
    }
    const devices = await listDevices(context);
    const smartDevices: SmartDevice[] = devices.map((device) => ({
      id: device.id,
      name: device.name,
      family: (device.type === "ANDROID" ? "PHONE" : device.type === "DESKTOP" ? "PC" : "OTHER") as SmartDevice["family"],
      protocol: (device.type === "ANDROID" ? "ANDROID_NATIVE" : device.type === "DESKTOP" ? "DESKTOP_NATIVE" : "HTTP_LOCAL") as SmartDevice["protocol"],
      online: device.status === "ONLINE",
      local: true,
      capabilities: [],
      metadata: { platform: device.platform }
    }));
    return resolveDeviceReference(body.query, smartDevices);
  });

  app.post("/v1/automation/scene/compile", async (request) => {
    await contextFor(request, config);
    const body = request.body as { name?: unknown; description?: unknown; steps?: unknown };
    if (typeof body.name !== "string" || !Array.isArray(body.steps)) {
      throw new PolarisError("VALIDATION_ERROR", "name y steps son obligatorios.", 400);
    }
    return compileScene({
      name: body.name,
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      steps: body.steps
    });
  });

  app.post("/v1/skills/studio", async (request) => {
    await contextFor(request, config);
    const body = request.body as { task?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    return designSkill(body.task);
  });

  app.post("/v1/visuals/orbit", async (request) => {
    await contextFor(request, config);
    const body = request.body as { mode?: unknown; state?: unknown };
    const allowedModes = ["CALM", "FOCUS", "CREATIVE", "RESEARCH", "OPERATOR", "COMPANION"];
    const allowedStates = ["IDLE", "LISTENING", "THINKING", "EXECUTING", "SPEAKING", "SUCCESS", "WARNING", "ERROR", "OFFLINE"];
    const modeValue = String(body.mode ?? "COMPANION").toUpperCase();
    const stateValue = String(body.state ?? "IDLE").toUpperCase();
    const mode = allowedModes.includes(modeValue) ? modeValue : "COMPANION";
    const state = allowedStates.includes(stateValue) ? stateValue : "IDLE";
    return buildVisualScene(
      mode as Parameters<typeof buildVisualScene>[0],
      state as Parameters<typeof buildVisualScene>[1]
    );
  });

  app.post("/v1/agent/suggestions", async (request) => {
    const context = await contextFor(request, config);
    const body = request.body as { task?: unknown; completed?: unknown };
    if (typeof body.task !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    const [memories, devices] = await Promise.all([listMemories(context), listDevices(context)]);
    return {
      suggestions: suggestNextActions({
        task: body.task,
        completed: body.completed !== false,
        hasConversation: true,
        deviceCount: devices.length,
        memoryCount: memories.length
      })
    };
  });

  app.get("/v1/health", async () => ({
    backend: "ok",
    database: hasSupabaseConfiguration(config) ? "configured" : "unconfigured",
    provider: provider.available ? "configured" : "unconfigured",
    version: "0.8.0"
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

  app.post("/v1/skills/preview", async (request) => {
    await contextFor(request, config);
    const body = request.body as { task?: unknown };
    if (typeof body.task !== "string" || !body.task.trim()) {
      throw new PolarisError("VALIDATION_ERROR", "task es obligatorio.", 400);
    }
    const program = composeSkillFromIntent(body.task);
    const fingerprint = skillFingerprint(program);
    const trace = createExecutionTrace({
      task: body.task.trim(),
      fingerprint,
      actions: program.steps.map((step) => ({ action: step.action }))
    });
    return {
      runtime: "polaris-skill-v1",
      dryRun: true,
      fingerprint,
      program,
      trace,
      recovery: program.steps.map((step) => recoveryPolicy({
        capability: "skill." + step.action,
        risk: "LOW",
        idempotent: step.action === "open_url" || step.action === "wait" || step.action === "scroll_top" || step.action === "scroll_bottom"
      }))
    };
  });

  app.post("/v1/skills/execute", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      task?: unknown;
      targetDeviceId?: unknown;
      preferredDevice?: unknown;
      requireConfirmation?: unknown;
      dryRun?: unknown;
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
    const trace = createExecutionTrace({
      task: body.task.trim(),
      fingerprint,
      targetDeviceId: target.id,
      actions: program.steps.map((step) => ({ action: step.action, device: target.type as DeviceType }))
    });
    const action = target.type === "ANDROID"
      ? "android.run_skill"
      : target.type === "WEB"
        ? "web.run_skill"
        : "desktop.run_skill";

    if (body.dryRun === true) {
      return reply.status(200).send({
        queued: false,
        dryRun: true,
        runtime: "polaris-skill-v1",
        fingerprint,
        trace,
        program
      });
    }

    const command = await createRelayCommand(context, {
      targetDeviceId: target.id,
      capabilityId: target.type === "ANDROID" ? "automation.skill_v1" : "desktop.skill_v1",
      action,
      payload: {
        program,
        task: body.task.trim(),
        fingerprint,
        trace
      },
      requiresConfirmation: body.requireConfirmation === true,
      ttlSeconds: 120
    });

    return reply.status(201).send({
      queued: true,
      runtime: "polaris-skill-v1",
      fingerprint,
      trace,
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

  app.post("/v1/devices/fabric/execute", async (request, reply) => {
    const context = await contextFor(request, config);
    const body = request.body as {
      targetDeviceId?: unknown;
      device?: unknown;
      action?: unknown;
      value?: unknown;
      confirmed?: unknown;
    };
    if (typeof body.targetDeviceId !== "string" ||
        !body.device || typeof body.device !== "object" ||
        typeof body.action !== "string") {
      throw new PolarisError("VALIDATION_ERROR", "targetDeviceId, device y action son obligatorios.", 400);
    }
    const device = body.device as SmartDevice;
    if (!deviceActions.includes(body.action as DeviceAction)) {
      throw new PolarisError("VALIDATION_ERROR", "Acción de dispositivo no soportada.", 400);
    }
    const command = compileDeviceCommand({
      device,
      action: body.action as DeviceAction,
      ...(typeof body.value === "string" || typeof body.value === "number" || typeof body.value === "boolean"
        ? { value: body.value }
        : {}),
      confirmed: body.confirmed === true
    });
    const relay = await createRelayCommand(context, {
      targetDeviceId: identifierSchema.parse(body.targetDeviceId),
      capabilityId: "device.fabric",
      action: `device.${command.action.toLowerCase()}`,
      payload: command as unknown as Record<string, unknown>,
      requiresConfirmation: ["REBOOT", "LOCK", "UNLOCK"].includes(command.action)
    });
    return reply.status(201).send({ command, relay });
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
