import type { DeviceType } from "@polaris/contracts";

export type CapabilityKind =
  | "CORE"
  | "WEB"
  | "ANDROID"
  | "DESKTOP"
  | "ROBOT"
  | "REMOTE";

export type CapabilityAvailability =
  | "AVAILABLE"
  | "PERMISSION_REQUIRED"
  | "OFFLINE"
  | "NOT_IMPLEMENTED";

export interface PolarisCapability {
  id: string;
  name: string;
  description: string;
  kinds: readonly CapabilityKind[];
  availability: Record<DeviceType, CapabilityAvailability>;
  requiresConfirmation: boolean;
  danger: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  composable: boolean;
}

const all = (...kinds: CapabilityKind[]) => kinds;

export const capabilityRegistry: readonly PolarisCapability[] = [
  {
    id: "core.chat",
    name: "Conversación",
    description: "Razonamiento y conversación con memoria contextual.",
    kinds: all("CORE"),
    availability: { WEB: "AVAILABLE", ANDROID: "AVAILABLE", DESKTOP: "AVAILABLE", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "LOW",
    composable: true
  },
  {
    id: "core.memory",
    name: "Memoria",
    description: "Leer, guardar, actualizar y borrar memorias explícitas del usuario.",
    kinds: all("CORE"),
    availability: { WEB: "AVAILABLE", ANDROID: "AVAILABLE", DESKTOP: "AVAILABLE", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "MEDIUM",
    composable: true
  },
  {
    id: "web.search",
    name: "Búsqueda web",
    description: "Consultar información pública en Internet.",
    kinds: all("WEB", "CORE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "LOW",
    composable: true
  },
  {
    id: "web.browser",
    name: "Navegador",
    description: "Abrir y operar páginas web cuando el cliente tenga un agente de navegador.",
    kinds: all("WEB", "DESKTOP", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "MEDIUM",
    composable: true
  },
  {
    id: "android.voice",
    name: "Voz Android",
    description: "Reconocimiento de voz y respuesta hablada.",
    kinds: all("ANDROID"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "AVAILABLE", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "LOW",
    composable: true
  },
  {
    id: "android.accessibility",
    name: "Automatización Android",
    description: "Navegar, pulsar elementos visibles, desplazar y abrir superficies del sistema mediante AccessibilityService con permiso explícito.",
    kinds: all("ANDROID", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "AVAILABLE", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "HIGH",
    composable: true
  },
  {
    id: "android.notifications",
    name: "Notificaciones Android",
    description: "Crear y administrar notificaciones locales cuando el usuario haya concedido permiso.",
    kinds: all("ANDROID"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "PERMISSION_REQUIRED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "LOW",
    composable: true
  },
  {
    id: "android.camera",
    name: "Cámara Android",
    description: "Capturar una imagen cuando el usuario conceda acceso a la cámara.",
    kinds: all("ANDROID"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "PERMISSION_REQUIRED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "MEDIUM",
    composable: true
  },
  {
    id: "android.screen",
    name: "Captura de pantalla Android",
    description: "Capturar la pantalla mediante la API del sistema con consentimiento.",
    kinds: all("ANDROID"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "PERMISSION_REQUIRED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "HIGH",
    composable: true
  },
  {
    id: "desktop.files",
    name: "Archivos PC",
    description: "Leer, crear, editar, copiar y mover archivos dentro de las carpetas autorizadas por el usuario.",
    kinds: all("DESKTOP"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "PERMISSION_REQUIRED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "HIGH",
    composable: true
  },
  {
    id: "desktop.windows",
    name: "Ventanas PC",
    description: "Consultar y organizar ventanas del escritorio mediante el companion nativo.",
    kinds: all("DESKTOP", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: false,
    danger: "MEDIUM",
    composable: true
  },
  {
    id: "desktop.input",
    name: "Entrada PC",
    description: "Teclado y ratón mediante acciones explícitas y verificables.",
    kinds: all("DESKTOP", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "HIGH",
    composable: true
  },
  {
    id: "desktop.shell",
    name: "Shell PC",
    description: "Ejecutar comandos locales permitidos mediante una lista de políticas, sin shell arbitrario por defecto.",
    kinds: all("DESKTOP"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "CRITICAL",
    composable: true
  },
  {
    id: "desktop.clipboard",
    name: "Portapapeles PC",
    description: "Leer y escribir el portapapeles con permisos y confirmación cuando sea sensible.",
    kinds: all("DESKTOP", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "MEDIUM",
    composable: true
  },
  {
    id: "robot.motion",
    name: "Movimiento robot",
    description: "Enviar comandos de movimiento a un robot Polaris compatible.",
    kinds: all("ROBOT", "REMOTE"),
    availability: { WEB: "NOT_IMPLEMENTED", ANDROID: "NOT_IMPLEMENTED", DESKTOP: "NOT_IMPLEMENTED", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "CRITICAL",
    composable: true
  },
  {
    id: "remote.relay",
    name: "Relay entre dispositivos",
    description: "Enviar un plan aprobado a otro dispositivo Polaris autenticado.",
    kinds: all("REMOTE", "CORE"),
    availability: { WEB: "AVAILABLE", ANDROID: "AVAILABLE", DESKTOP: "AVAILABLE", ROBOT: "NOT_IMPLEMENTED" },
    requiresConfirmation: true,
    danger: "HIGH",
    composable: true
  }
];

export interface CapabilityRequest {
  task: string;
  preferredDevice?: DeviceType;
  requiredCapabilities?: readonly string[];
  allowRemote?: boolean;
}

export interface CapabilityRouteStep {
  capabilityId: string;
  device: DeviceType;
  availability: CapabilityAvailability;
  requiresConfirmation: boolean;
}

export interface CapabilityRoute {
  status: "READY" | "NEEDS_PERMISSION" | "NEEDS_COMPANION" | "UNAVAILABLE";
  strategy: "LOCAL" | "REMOTE" | "CORE_ONLY" | "FALLBACK";
  explanation: string;
  steps: readonly CapabilityRouteStep[];
}

function capabilityFor(id: string): PolarisCapability | undefined {
  return capabilityRegistry.find((capability) => capability.id === id);
}

export function routeCapabilities(request: CapabilityRequest): CapabilityRoute {
  const requested = request.requiredCapabilities?.map(capabilityFor).filter(Boolean) as PolarisCapability[] | undefined;
  if (!requested?.length) {
    return {
      status: "READY",
      strategy: "CORE_ONLY",
      explanation: "La tarea puede comenzar en Polaris Core y negociar herramientas adicionales después.",
      steps: []
    };
  }

  const preferred = request.preferredDevice;
  const steps: CapabilityRouteStep[] = [];

  for (const capability of requested) {
    const candidateOrder: DeviceType[] = preferred
      ? [preferred, "ANDROID", "DESKTOP", "WEB"]
      : ["ANDROID", "DESKTOP", "WEB"];

    const candidate = candidateOrder
      .map((device) => ({ device, availability: capability.availability[device] }))
      .find(({ availability }) => availability === "AVAILABLE" || availability === "PERMISSION_REQUIRED");

    if (!candidate) {
      return {
        status: request.allowRemote ? "NEEDS_COMPANION" : "UNAVAILABLE",
        strategy: request.allowRemote ? "REMOTE" : "FALLBACK",
        explanation: "No hay una capacidad local implementada; Polaris debe solicitar un companion o usar un resultado alternativo.",
        steps
      };
    }

    steps.push({
      capabilityId: capability.id,
      device: candidate.device,
      availability: candidate.availability,
      requiresConfirmation: capability.requiresConfirmation
    });
  }

  const hasPermission = steps.some((step) => step.availability === "PERMISSION_REQUIRED");
  const remote = steps.some((step) => step.device !== (preferred ?? steps[0]?.device));

  return {
    status: hasPermission ? "NEEDS_PERMISSION" : "READY",
    strategy: remote ? "REMOTE" : "LOCAL",
    explanation: hasPermission
      ? "La ruta existe, pero necesita que el usuario conceda el permiso local correspondiente."
      : remote
        ? "La tarea se repartirá entre dispositivos capaces y el Core conservará el contexto."
        : "La tarea tiene una ruta local compatible.",
    steps
  };
}
