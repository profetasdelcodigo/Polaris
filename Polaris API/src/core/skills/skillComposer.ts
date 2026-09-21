import { PolarisError } from "../../errors.js";
import { validateSkillProgram, type PolarisSkillProgram } from "./skillRuntime.js";

type SkillIntent = {
  phrases: string[];
  build: (task: string) => PolarisSkillProgram | null;
};

const intents: SkillIntent[] = [
  {
    phrases: ["abre youtube", "abrir youtube", "abre google", "abrir google"],
    build: () => ({
      version: 1,
      name: "Abrir sitio solicitado",
      description: "Abre un sitio público en el navegador predeterminado.",
      steps: [{ action: "open_url", url: "https://www.youtube.com" }]
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
  }
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function composeSkillFromIntent(task: string): PolarisSkillProgram {
  const normalized = normalize(task);
  const match = intents.find((intent) => intent.phrases.some((phrase) => normalized.includes(normalize(phrase))));
  if (!match) {
    throw new PolarisError(
      "NOT_FOUND",
      "No existe una plantilla segura para convertir esta petición en una Polaris Skill v1.",
      404
    );
  }

  const program = match.build(task);
  if (!program) {
    throw new PolarisError("VALIDATION_ERROR", "La petición no pudo convertirse en una skill segura.", 400);
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
    }
  };
}
