export type DesktopSkillStep =
  | { action: "open_url"; url: string }
  | { action: "reveal_path"; path: string }
  | { action: "system_info" }
  | { action: "copy_text"; text: string }
  | { action: "scroll_top" }
  | { action: "scroll_bottom" }
  | { action: "focus_chat" }
  | { action: "wait"; ms: number };

export interface DesktopSkillProgram {
  version: 1;
  name: string;
  description?: string;
  steps: DesktopSkillStep[];
}

export interface DesktopSkillResult {
  ok: boolean;
  name: string;
  executed: number;
  results: Array<Record<string, unknown>>;
  error?: string;
}

const MAX_STEPS = 12;
const MAX_TEXT = 20_000;
const MAX_WAIT = 10_000;

export function validateDesktopSkill(program: unknown): DesktopSkillProgram {
  if (!program || typeof program !== "object") throw new Error("El skill no es un objeto válido.");
  const value = program as Record<string, unknown>;
  if (value.version !== 1) throw new Error("Versión de skill no soportada.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 120) {
    throw new Error("El skill necesita un nombre válido.");
  }
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > MAX_STEPS) {
    throw new Error(`Un skill debe contener entre 1 y ${MAX_STEPS} pasos.`);
  }
  return {
    version: 1,
    name: value.name.trim(),
    description: typeof value.description === "string" ? value.description.slice(0, 500) : undefined,
    steps: value.steps.map((raw, index) => validateStep(raw, index))
  };
}

function validateStep(raw: unknown, index: number): DesktopSkillStep {
  if (!raw || typeof raw !== "object") throw new Error(`Paso ${index + 1} inválido.`);
  const step = raw as Record<string, unknown>;
  if (typeof step.action !== "string") throw new Error(`Paso ${index + 1}: falta action.`);

  switch (step.action) {
    case "open_url":
      if (typeof step.url !== "string" || !/^https?:\\/\\//i.test(step.url) || step.url.length > 2_000) {
        throw new Error(`Paso ${index + 1}: URL HTTP/HTTPS inválida.`);
      }
      return { action: "open_url", url: step.url };
    case "reveal_path":
      if (typeof step.path !== "string" || !step.path.trim() || step.path.length > 4_096) {
        throw new Error(`Paso ${index + 1}: ruta inválida.`);
      }
      return { action: "reveal_path", path: step.path };
    case "system_info":
      return { action: "system_info" };
    case "copy_text":
      if (typeof step.text !== "string" || step.text.length > MAX_TEXT) {
        throw new Error(`Paso ${index + 1}: texto inválido.`);
      }
      return { action: "copy_text", text: step.text };
    case "scroll_top":
    case "scroll_bottom":
    case "focus_chat":
      return { action: step.action };
    case "wait":
      if (typeof step.ms !== "number" || !Number.isInteger(step.ms) || step.ms < 0 || step.ms > MAX_WAIT) {
        throw new Error(`Paso ${index + 1}: espera inválida.`);
      }
      return { action: "wait", ms: step.ms };
    default:
      throw new Error(`Paso ${index + 1}: acción no permitida: ${step.action}.`);
  }
}

export async function executeDesktopSkill(
  program: unknown,
  handlers: {
    openUrl(url: string): Promise<void>;
    revealPath(path: string): Promise<void>;
    systemInfo(): Promise<Record<string, unknown>>;
    copyText(text: string): Promise<void>;
    scrollTop(): void;
    scrollBottom(): void;
    focusChat(): void;
  }
): Promise<DesktopSkillResult> {
  const skill = validateDesktopSkill(program);
  const results: Array<Record<string, unknown>> = [];

  for (let index = 0; index < skill.steps.length; index += 1) {
    const step = skill.steps[index];
    switch (step.action) {
      case "open_url":
        await handlers.openUrl(step.url);
        results.push({ step: index + 1, action: step.action, url: step.url });
        break;
      case "reveal_path":
        await handlers.revealPath(step.path);
        results.push({ step: index + 1, action: step.action, path: step.path });
        break;
      case "system_info":
        results.push({ step: index + 1, action: step.action, system: await handlers.systemInfo() });
        break;
      case "copy_text":
        await handlers.copyText(step.text);
        results.push({ step: index + 1, action: step.action, length: step.text.length });
        break;
      case "scroll_top":
        handlers.scrollTop();
        results.push({ step: index + 1, action: step.action });
        break;
      case "scroll_bottom":
        handlers.scrollBottom();
        results.push({ step: index + 1, action: step.action });
        break;
      case "focus_chat":
        handlers.focusChat();
        results.push({ step: index + 1, action: step.action });
        break;
      case "wait":
        await new Promise((resolve) => window.setTimeout(resolve, step.ms));
        results.push({ step: index + 1, action: step.action, ms: step.ms });
        break;
    }
  }

  return { ok: true, name: skill.name, executed: skill.steps.length, results };
}
