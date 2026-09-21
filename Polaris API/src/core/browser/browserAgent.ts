import { PolarisError } from "../../errors.js";
import type { BrowserContext } from "./browserContext.js";

export type BrowserAgentStep =
  | { action: "OPEN_URL"; url: string }
  | { action: "SEARCH"; query: string }
  | { action: "READ_VISIBLE_TEXT" }
  | { action: "SELECT_TEXT"; text: string }
  | { action: "WAIT_FOR_NAVIGATION" };

export type BrowserAgentPlan = {
  version: 1;
  objective: string;
  steps: BrowserAgentStep[];
  verification: string[];
};

function searchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
}

export function planBrowserAgent(task: string, context?: BrowserContext | null): BrowserAgentPlan {
  const normalized = task.trim();
  if (!normalized) {
    throw new PolarisError("VALIDATION_ERROR", "La tarea del navegador no puede estar vacía.", 400);
  }

  const steps: BrowserAgentStep[] = [];
  if (/abre|ir a|entra a/i.test(normalized)) {
    const url = normalized.match(/https?:\/\/[^\s]+/i)?.[0];
    if (url) steps.push({ action: "OPEN_URL", url });
  }

  if (/busca|buscar|investiga|googlea/i.test(normalized)) {
    const match = normalized.match(/(?:busca|buscar|investiga|googlea)\s+(.+)/iu);
    if (match?.[1]) steps.push({ action: "SEARCH", query: match[1].trim() });
  }

  if (/lee|leer|qué dice|que dice|resume|resumir/i.test(normalized)) {
    steps.push({ action: "READ_VISIBLE_TEXT" });
  }

  const selected = context?.selectedText?.trim();
  if (selected && /seleccion|texto seleccionado/i.test(normalized)) {
    steps.push({ action: "SELECT_TEXT", text: selected.slice(0, 1000) });
  }

  if (!steps.length) {
    throw new PolarisError(
      "NOT_FOUND",
      "Polaris aún no tiene una plantilla segura para esa operación de navegador.",
      404
    );
  }

  steps.push({ action: "WAIT_FOR_NAVIGATION" });
  return {
    version: 1,
    objective: normalized,
    steps,
    verification: [
      "Confirmar que la navegación terminó.",
      "Capturar la URL y título actuales cuando la integración lo permita.",
      "No considerar éxito sin una señal observable de cambio."
    ]
  };
}

export function browserAgentPreview(plan: BrowserAgentPlan) {
  return {
    runtime: "browser-agent-v1",
    objective: plan.objective,
    stepCount: plan.steps.length,
    safeActionsOnly: true,
    verification: plan.verification
  };
}

export { searchUrl };
