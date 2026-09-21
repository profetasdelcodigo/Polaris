import { PolarisError } from "../../errors.js";
import { validateSkillProgram, type PolarisSkillProgram } from "./skillRuntime.js";

type SkillIntent = {
  phrases: string[];
  build: (task: string) => PolarisSkillProgram | null;
};

const intents: SkillIntent[] = [
  {
    phrases: ["abre youtube", "abrir youtube", "abre google", "abrir google"],
    build: (task) => ({
      version: 1,
      name: "Abrir sitio solicitado",
      description: "Abre un sitio público en el navegador predeterminado.",
      steps: [{
        action: "open_url",
        url: /google/i.test(task) ? "https://www.google.com" : "https://www.youtube.com"
      }]
    })
  },
  {
    phrases: ["abre github", "abrir github"],
    build: () => ({
      version: 1,
      name: "Abrir GitHub",
      description: "Abre GitHub en el navegador.",
      steps: [{ action: "open_url", url: "https://github.com" }]
    })
  },
  {
    phrases: ["informacion del pc", "información del pc", "info del sistema", "datos de mi pc"],
    build: () => ({
      version: 1,
      name: "Diagnóstico rápido del PC",
      description: "Obtiene información básica del equipo sin ejecutar comandos.",
      steps: [{ action: "system_info" }]
    })
  },
  {
    phrases: ["enfoca el chat", "focus chat", "pon el cursor en el chat"],
    build: () => ({
      version: 1,
      name: "Enfocar chat",
      description: "Devuelve el foco a la entrada de Polaris.",
      steps: [{ action: "focus_chat" }]
    })
  },
  {
    phrases: ["sube arriba", "ve arriba", "scroll arriba"],
    build: () => ({
      version: 1,
      name: "Ir arriba",
      description: "Desplaza la superficie de Polaris hasta el inicio.",
      steps: [{ action: "scroll_top" }]
    })
  },
  {
    phrases: ["baja abajo", "ve abajo", "scroll abajo"],
    build: () => ({
      version: 1,
      name: "Ir abajo",
      description: "Desplaza la superficie de Polaris hasta el final.",
      steps: [{ action: "scroll_bottom" }]
    })
  },
  {
    phrases: ["copiar texto", "copia texto", "copiame", "cópia"],
    build: (task) => {
      const match = task.match(/(?:copiar|copia|cópia|copiame)\s+(?:texto\s+)?(.+)/iu);
      if (!match?.[1]) return null;
      return {
        version: 1,
        name: "Copiar texto",
        description: "Coloca texto explícito en el portapapeles del runtime compatible.",
        steps: [{ action: "copy_text", text: match[1].trim().slice(0, 20_000) }]
      };
    }
  },
  {
    phrases: ["espera ", "espera", "espera un momento", "pausa"],
    build: (task) => {
      const match = task.match(/(\d{1,5})\s*(?:ms|milisegundos|segundos|s)?$/iu);
      const raw = Number(match?.[1] ?? 1);
      const milliseconds = match?.[0]?.toLocaleLowerCase("es-PE").includes("ms") ? raw : raw * 1000;
      return {
        version: 1,
        name: "Espera controlada",
        description: "Introduce una espera acotada dentro del Skill.",
        steps: [{ action: "wait", ms: Math.min(10_000, Math.max(0, milliseconds)) }]
      };
    }
  },
  {
    phrases: ["abre http://", "abre https://", "abrir http://", "abrir https://", "open http://", "open https://"],
    build: (task) => {
      const match = task.match(/(https?:\/\/[^\s]+)$/iu);
      if (!match?.[1]) return null;
      return {
        version: 1,
        name: "Abrir URL indicada",
        description: "Abre una URL HTTP/HTTPS explícita.",
        steps: [{ action: "open_url", url: match[1].replace(/[),.;!?]+$/u, "") }]
      };
    }
  }
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildCompoundSkill(task: string): PolarisSkillProgram | null {
  const parts = task
    .split(/\s+(?:y luego|después|luego)\s+/iu)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 6) return null;

  const steps: PolarisSkillProgram["steps"] = [];
  for (const part of parts) {
    try {
      const program = composeSkillFromIntent(part);
      steps.push(...program.steps);
    } catch {
      return null;
    }
  }

  if (!steps.length) return null;
  return validateSkillProgram({
    version: 1,
    name: "Skill compuesto de Polaris",
    description: "Combina varias acciones previamente permitidas.",
    steps
  });
}

export function composeSkillFromIntent(task: string): PolarisSkillProgram {
  const normalized = normalize(task);
  const match = intents.find((intent) =>
    intent.phrases.some((phrase) => normalized.includes(normalize(phrase)))
  );

  const program = match ? match.build(task) : buildCompoundSkill(task);
  if (!program) {
    throw new PolarisError(
      "NOT_FOUND",
      "No existe una plantilla segura para convertir esta petición en una Polaris Skill v1.",
      404
    );
  }

  return validateSkillProgram(program);
}

export function skillComposerCatalog() {
  return {
    runtime: "polaris-skill-v1",
    templates: intents.map((intent) => ({
      phrases: intent.phrases,
      composable: true
    })),
    limits: {
      maxSteps: 12,
      maxWaitMs: 10_000,
      maxSerializedBytes: 32_000
    },
    supportsCompoundSkills: true
  };
}
