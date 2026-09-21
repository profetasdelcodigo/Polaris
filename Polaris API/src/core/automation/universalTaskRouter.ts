import crypto from "node:crypto";
import type {
  DeviceType,
  ExecutionBackend,
  CapabilityAvailability,
  UniversalTaskPlan,
  UniversalTaskRequest,
  UniversalTaskRisk,
  UniversalTaskStep
} from "@polaris/contracts";
import { capabilityRegistry } from "../capabilities/capabilityRegistry.js";

/**
 * UniversalTaskRouter is deliberately a planner, not a fake executor.
 * It produces a verified execution graph that a capable client/companion can execute.
 * The critical loop is observe -> locate -> act -> verify -> recover.
 */

type CapabilityRecord = {
  id: string;
  name: string;
  description: string;
  availability: Record<DeviceType, CapabilityAvailability>;
  requiresConfirmation: boolean;
  danger: UniversalTaskRisk;
  composable: boolean;
};

const capabilities = capabilityRegistry as readonly CapabilityRecord[];

const intents: Array<{
  phrases: readonly string[];
  capabilityIds: readonly string[];
  fallbackIds: readonly string[];
  preferred?: DeviceType;
  risk: UniversalTaskRisk;
}> = [
  { phrases: ["pantalla", "captura", "screenshot"], capabilityIds: ["android.screen"], fallbackIds: ["web.browser"], preferred: "ANDROID", risk: "HIGH" },
  { phrases: ["notificación", "notificaciones"], capabilityIds: ["android.notifications"], fallbackIds: ["android.accessibility"], preferred: "ANDROID", risk: "LOW" },
  { phrases: ["wifi", "wi-fi", "bluetooth"], capabilityIds: ["android.accessibility"], fallbackIds: ["remote.relay"], preferred: "ANDROID", risk: "HIGH" },
  { phrases: ["archivo", "carpeta", "descargas", "documento"], capabilityIds: ["desktop.files"], fallbackIds: ["web.browser"], preferred: "DESKTOP", risk: "HIGH" },
  { phrases: ["ventana", "teclado", "mouse", "ratón", "clic", "programa", "aplicación en pc"], capabilityIds: ["desktop.windows", "desktop.input"], fallbackIds: ["desktop.files"], preferred: "DESKTOP", risk: "HIGH" },
  { phrases: ["comando", "terminal", "powershell", "cmd", "bash"], capabilityIds: ["desktop.shell"], fallbackIds: ["core.chat"], preferred: "DESKTOP", risk: "CRITICAL" },
  { phrases: ["navegador", "web", "página", "sitio", "youtube", "google"], capabilityIds: ["web.browser"], fallbackIds: ["core.chat"], preferred: "WEB", risk: "MEDIUM" },
  { phrases: ["buscar", "investiga", "consulta internet"], capabilityIds: ["web.search"], fallbackIds: ["core.chat"], preferred: "WEB", risk: "LOW" },
  { phrases: ["robot", "mueve", "mover brazo", "sensor"], capabilityIds: ["robot.motion"], fallbackIds: ["remote.relay"], preferred: "ROBOT", risk: "CRITICAL" },
  { phrases: ["recuerda", "memoriza", "olvida"], capabilityIds: ["core.memory"], fallbackIds: ["core.chat"], risk: "MEDIUM" },
  { phrases: ["continua", "continúa", "reanuda", "sigue desde donde quede", "retoma"], capabilityIds: ["task.continuity"], fallbackIds: ["remote.relay", "core.context"], risk: "LOW" },
  { phrases: ["handoff", "pásalo al", "pasalo al", "continua en mi pc", "continúa en mi pc", "continua en mi celular", "continúa en mi celular"], capabilityIds: ["task.continuity", "remote.safe_handoff"], fallbackIds: ["core.chat"], risk: "MEDIUM" },
  { phrases: ["modo estudio", "concentracion", "concentración", "sin distracciones"], capabilityIds: ["core.context", "desktop.local_control", "android.accessibility"], fallbackIds: ["core.chat"], risk: "MEDIUM" },
  { phrases: ["modo urgente", "urgente", "ahora mismo"], capabilityIds: ["core.context", "core.skill_runtime"], fallbackIds: ["core.chat"], risk: "MEDIUM" },
  { phrases: ["investiga a fondo", "investiga profundamente", "investigacion profunda", "investigación profunda"], capabilityIds: ["research.deep_plan", "research.contradiction_check"], fallbackIds: ["core.chat"], preferred: "WEB", risk: "LOW" },
  { phrases: ["hazme una rutina", "crea una rutina", "automatiza esto", "guarda este comando"], capabilityIds: ["core.chat", "core.audit"], fallbackIds: ["core.chat"], risk: "MEDIUM" },
  { phrases: ["detente", "para todo", "cancela la automatizacion", "cancela la automatización"], capabilityIds: ["security.emergency_stop"], fallbackIds: ["core.chat"], risk: "LOW" }
];

function normalize(text: string): string {
  return text.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function capability(id: string): CapabilityRecord | undefined {
  return capabilities.find((entry) => entry.id === id);
}

function backendFor(device: DeviceType): ExecutionBackend {
  return device === "ANDROID" ? "ANDROID"
    : device === "DESKTOP" ? "DESKTOP"
      : device === "ROBOT" ? "REMOTE"
        : "WEB";
}

function chooseDevice(
  entry: CapabilityRecord,
  request: UniversalTaskRequest,
  preferred: DeviceType | undefined
): { device: DeviceType; requiresPermission: boolean } | null {
  const order = preferred
    ? [preferred, "ANDROID", "DESKTOP", "WEB", "ROBOT"] as DeviceType[]
    : ["ANDROID", "DESKTOP", "WEB", "ROBOT"] as DeviceType[];

  for (const device of order) {
    const status = entry.availability[device];
    if (status === "AVAILABLE" || status === "PERMISSION_REQUIRED") {
      return {
        device,
        requiresPermission: status === "PERMISSION_REQUIRED"
      };
    }
  }

  if (request.allowRemote !== false) {
    return {
      device: preferred ?? "WEB",
      requiresPermission: false
    };
  }

  return null;
}

function step(
  index: number,
  stage: UniversalTaskStep["stage"],
  entry: CapabilityRecord,
  device: DeviceType,
  purpose: string,
  requiresPermission: boolean,
  fallbackCapabilityId?: string
): UniversalTaskStep {
  return {
    id: `step-${index + 1}`,
    stage,
    backend: backendFor(device),
    capabilityId: entry.id,
    purpose,
    requiresPermission,
    requiresConfirmation: entry.requiresConfirmation,
    risk: entry.danger,
    ...(fallbackCapabilityId ? { fallbackCapabilityId } : {})
  };
}

export function planUniversalTask(request: UniversalTaskRequest): UniversalTaskPlan {
  const normalized = normalize(request.task).trim();
  const planId = `pt_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const maxSteps = Math.max(3, Math.min(request.maxSteps ?? 12, 24));

  const matched = intents.find((intent) => intent.phrases.some((phrase) => normalized.includes(normalize(phrase))));
  const selectedIds = matched?.capabilityIds ?? ["core.chat"];
  const fallbackIds = matched?.fallbackIds ?? ["remote.relay", "core.chat"];
  const preferredDevice = request.preferredDevice ?? matched?.preferred;

  const steps: UniversalTaskStep[] = [];
  let needsPermission = false;
  let needsConfirmation = false;
  let unavailable = false;
  const rationale: string[] = [];

  const primaryIds = [...selectedIds].slice(0, Math.max(1, maxSteps - 2));

  for (const [index, id] of primaryIds.entries()) {
    const entry = capability(id);
    if (!entry) {
      unavailable = true;
      continue;
    }

    const selection = chooseDevice(entry, request, preferredDevice);
    if (!selection) {
      unavailable = true;
      continue;
    }

    needsPermission ||= selection.requiresPermission;
    needsConfirmation ||= entry.requiresConfirmation;

    steps.push(
      step(
        index,
        "OBSERVE",
        entry,
        selection.device,
        `Observar el estado necesario antes de intentar ${entry.name.toLocaleLowerCase("es-PE")}.`,
        selection.requiresPermission
      )
    );

    steps.push(
      step(
        index + primaryIds.length,
        "LOCATE",
        entry,
        selection.device,
        `Localizar el objetivo relevante para ${entry.name.toLocaleLowerCase("es-PE")} con el selector más estructurado disponible.`,
        selection.requiresPermission
      )
    );

    steps.push(
      step(
        index + primaryIds.length * 2,
        "ACT",
        entry,
        selection.device,
        `Ejecutar la acción solicitada utilizando la superficie autorizada de ${selection.device}.`,
        selection.requiresPermission
      )
    );

    if (request.requireVerification !== false) {
      steps.push(
        step(
          index + primaryIds.length * 3,
          "VERIFY",
          entry,
          selection.device,
          "Comprobar el resultado observable y no asumir que la acción funcionó.",
          selection.requiresPermission
        )
      );
    }
  }

  if (steps.length > 0) {
    const fallback = fallbackIds.find((id) => capability(id));
    if (fallback) {
      const entry = capability(fallback);
      if (entry) {
        const selection = chooseDevice(entry, request, preferredDevice);
        if (selection) {
          steps.push(
            step(
              steps.length,
              "RECOVER",
              entry,
              selection.device,
              "Usar una ruta alternativa cuando la observación, localización, acción o verificación falle.",
              selection.requiresPermission,
              entry.id
            )
          );
        }
      }
    }
  }

  rationale.push("Polaris observa antes de actuar para reducir acciones a ciegas.");
  rationale.push("Polaris verifica el resultado cuando el cliente puede devolver una observación.");
  rationale.push("El plan mantiene una ruta de recuperación en lugar de quedarse bloqueado ante la primera UI distinta.");
  if (request.allowRemote !== false) rationale.push("Se permite delegar a otro dispositivo autenticado cuando la plataforma actual no tiene la capacidad necesaria.");

  let status: UniversalTaskPlan["status"] = "READY";
  if (unavailable && steps.length === 0) status = "UNAVAILABLE";
  else if (needsPermission) status = "NEEDS_PERMISSION";
  else if (needsConfirmation) status = "NEEDS_CONFIRMATION";

  const strategy = preferredDevice
    ? "LOCAL_FIRST"
    : steps.some((entry) => entry.backend === "REMOTE")
      ? "REMOTE_FIRST"
      : "CORE_FIRST";

  return {
    planId,
    status,
    task: request.task,
    ...(preferredDevice ? { preferredDevice } : {}),
    strategy,
    observeBeforeAct: true,
    verifyAfterAct: request.requireVerification !== false,
    steps,
    fallbacks: fallbackIds,
    rationale
  };
}

export function universalCatalogStats() {
  const byDevice = Object.fromEntries(
    (["WEB", "ANDROID", "DESKTOP", "ROBOT"] as const).map((device) => [
      device,
      capabilities.filter((entry) => entry.availability[device] !== "NOT_IMPLEMENTED").length
    ])
  );
  return {
    capabilityCount: capabilities.length,
    intentFamilyCount: intents.length,
    byDevice
  };
}
