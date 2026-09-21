import crypto from "node:crypto";
import type { DeviceType, UniversalTaskRisk } from "@polaris/contracts";
import { inferAdaptiveMode, type AdaptiveMode } from "../context/adaptiveContext.js";

export interface AgentPlanStep {
  id: string;
  title: string;
  purpose: string;
  stage: "UNDERSTAND" | "OBSERVE" | "PLAN" | "ACT" | "VERIFY" | "RECOVER" | "COMPLETE";
  device?: DeviceType;
  capability: string;
  risk: UniversalTaskRisk;
  requiresConfirmation: boolean;
}

export interface AgentPlan {
  planId: string;
  objective: string;
  mode: AdaptiveMode;
  status: "READY" | "NEEDS_CONFIRMATION" | "NEEDS_PERMISSION" | "UNAVAILABLE";
  strategy: "LOCAL_FIRST" | "REMOTE_FIRST" | "RESEARCH_FIRST" | "CORE_FIRST";
  risk: UniversalTaskRisk;
  steps: readonly AgentPlanStep[];
  verification: string[];
  recovery: string[];
  notes: string[];
}

const normalize = (value: string) =>
  value.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function riskFor(text: string): UniversalTaskRisk {
  if (/(borrar|elimina|eliminar|formatea|shell|terminal|powershell|dinero|compra|publica|envia|envía)/.test(text)) return "CRITICAL";
  if (/(archivo|carpeta|clic|teclado|notificacion|notificación|pantalla|camara|cámara|accesibilidad)/.test(text)) return "HIGH";
  if (/(abrir|buscar|investigar|resumir|traducir|copiar)/.test(text)) return "LOW";
  return "MEDIUM";
}

function deviceFor(text: string): DeviceType | undefined {
  if (/(android|telefono|teléfono|móvil|movil)/.test(text)) return "ANDROID";
  if (/(pc|computadora|ordenador|desktop|windows)/.test(text)) return "DESKTOP";
  if (/(web|navegador|browser)/.test(text)) return "WEB";
  return undefined;
}

export function planAgentTask(input: {
  task: string;
  preferredDevice?: DeviceType;
  preferredMode?: string;
  requireVerification?: boolean;
}): AgentPlan {
  const objective = input.task.trim().slice(0, 4_000);
  const text = normalize(objective);
  const mode = inferAdaptiveMode(objective, input.preferredMode);
  const risk = riskFor(text);
  const preferredDevice = input.preferredDevice ?? deviceFor(text);
  const steps: AgentPlanStep[] = [];

  const add = (
    title: string,
    purpose: string,
    stage: AgentPlanStep["stage"],
    capability: string,
    stepRisk: UniversalTaskRisk,
    requiresConfirmation = false
  ) => {
    steps.push({
      id: "agent-" + (steps.length + 1),
      title,
      purpose,
      stage,
      ...(preferredDevice ? { device: preferredDevice } : {}),
      capability,
      risk: stepRisk,
      requiresConfirmation
    });
  };

  add("Entender objetivo", "Normalizar la intención y fijar el resultado esperado.", "UNDERSTAND", "core.chat", "LOW");

  if (mode === "RESEARCH") {
    add("Descomponer investigación", "Separar la pregunta en subpreguntas y consultas verificables.", "PLAN", "research.deep_plan", "LOW");
    add("Recolectar evidencia", "Preparar búsquedas, fuentes primarias/secundarias y criterios de contraste.", "ACT", "web.research", "LOW");
    add("Contrastar", "Buscar contradicciones y separar hechos, análisis y opinión.", "VERIFY", "research.contradiction_check", "LOW");
  } else {
    add("Observar contexto", "Consultar estado del dispositivo y de la superficie antes de actuar.", "OBSERVE", "core.context", "LOW");
    if (preferredDevice) {
      add("Elegir capacidad", "Seleccionar la capacidad real del dispositivo indicado o delegar si es necesario.", "PLAN", "core.capability_negotiation", "LOW");
    }
    add("Ejecutar", "Realizar únicamente acciones permitidas por la plataforma y por la política de seguridad.", "ACT", "core.skill_runtime", risk, risk === "HIGH" || risk === "CRITICAL");
  }

  add(
    "Verificar resultado",
    "Comprobar evidencia observable de que la acción terminó como se esperaba.",
    "VERIFY",
    "core.verification",
    input.requireVerification === false ? "LOW" : risk
  );

  add(
    "Recuperar",
    "Aplicar una ruta alternativa segura o devolver el fallo exacto sin fingir éxito.",
    "RECOVER",
    "core.recovery",
    "LOW"
  );

  add("Completar", "Entregar resultado, contexto y próximos pasos únicamente cuando estén respaldados por la ejecución.", "COMPLETE", "core.audit", "LOW");

  const needsConfirmation = steps.some((step) => step.requiresConfirmation);
  const status: AgentPlan["status"] = needsConfirmation
    ? "NEEDS_CONFIRMATION"
    : "READY";

  const strategy: AgentPlan["strategy"] =
    mode === "RESEARCH" ? "RESEARCH_FIRST" :
      preferredDevice ? "LOCAL_FIRST" :
        "CORE_FIRST";

  return {
    planId: "ag_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    objective,
    mode,
    status,
    strategy,
    risk,
    steps,
    verification: [
      "No asumir éxito porque una herramienta respondió sin error.",
      "Conservar el estado y la evidencia relevante de la operación.",
      "Si no existe evidencia suficiente, informar incertidumbre."
    ],
    recovery: [
      "Reintento acotado cuando la acción sea idempotente.",
      "Usar una capacidad alternativa compatible.",
      "Delegar a otro dispositivo solamente si está autenticado y disponible.",
      "Detenerse con un error explícito cuando no exista una ruta segura."
    ],
    notes: [
      "La IA planifica; los runtimes de plataforma ejecutan.",
      "No se habilita ejecución arbitraria de shell, JavaScript o código nativo generado por la IA."
    ]
  };
}
