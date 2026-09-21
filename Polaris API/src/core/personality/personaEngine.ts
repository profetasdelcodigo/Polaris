export type PersonaMode =
  | "CALM"
  | "FOCUS"
  | "CREATIVE"
  | "RESEARCH"
  | "OPERATOR"
  | "COMPANION";

export type PersonaProfile = {
  mode: PersonaMode;
  tone: "warm" | "neutral" | "precise" | "energetic";
  verbosity: "concise" | "balanced" | "deep";
  initiative: "reactive" | "guided" | "proactive";
  confirmationStyle: "minimal" | "explicit" | "strict";
  visualEnergy: "quiet" | "steady" | "vivid";
  guidelines: string[];
  greetingStyle: string;
};

export function detectPersonaMode(task: string, preferredMode?: string | null): PersonaMode {
  const explicit = preferredMode?.toUpperCase();
  if (
    explicit === "CALM" ||
    explicit === "FOCUS" ||
    explicit === "CREATIVE" ||
    explicit === "RESEARCH" ||
    explicit === "OPERATOR" ||
    explicit === "COMPANION"
  ) {
    return explicit;
  }

  const value = task.toLocaleLowerCase("es-PE");
  if (/abre|cierra|enciende|apaga|ejecuta|configura|automat|dispositivo|pc|telefono|tv|luz|router/.test(value)) return "OPERATOR";
  if (/investig|fuentes|compara|estudia|analiza|evidencia|paper|datos/.test(value)) return "RESEARCH";
  if (/idea|diseña|crea|inventa|nombre|logo|guion|música|arte/.test(value)) return "CREATIVE";
  if (/estudia|tarea|examen|concentr|programa|código|codifica|depura|aprende/.test(value)) return "FOCUS";
  if (/calma|respira|tranquilo|ansiedad|pausa|descansa/.test(value)) return "CALM";
  return "COMPANION";
}

export function buildPersonaProfile(input: {
  task: string;
  tone?: string | null;
  responseStyle?: string | null;
  preferredMode?: string | null;
}): PersonaProfile {
  const mode = detectPersonaMode(input.task, input.preferredMode);
  const profileByMode: Record<PersonaMode, Omit<PersonaProfile, "mode">> = {
    CALM: {
      tone: "warm",
      verbosity: "balanced",
      initiative: "guided",
      confirmationStyle: "explicit",
      visualEnergy: "quiet",
      guidelines: ["prioriza claridad", "evita saturar", "propón un siguiente paso simple"],
      greetingStyle: "sereno"
    },
    FOCUS: {
      tone: "precise",
      verbosity: "balanced",
      initiative: "guided",
      confirmationStyle: "minimal",
      visualEnergy: "steady",
      guidelines: ["reduce distracciones", "agrupa pasos", "señala bloqueos de forma directa"],
      greetingStyle: "enfocado"
    },
    CREATIVE: {
      tone: "energetic",
      verbosity: "deep",
      initiative: "proactive",
      confirmationStyle: "minimal",
      visualEnergy: "vivid",
      guidelines: ["explora variantes", "combina ideas", "mantén las decisiones reversibles"],
      greetingStyle: "creativo"
    },
    RESEARCH: {
      tone: "precise",
      verbosity: "deep",
      initiative: "guided",
      confirmationStyle: "explicit",
      visualEnergy: "steady",
      guidelines: ["separa evidencia de inferencia", "marca incertidumbre", "prioriza trazabilidad"],
      greetingStyle: "analítico"
    },
    OPERATOR: {
      tone: "precise",
      verbosity: "concise",
      initiative: "proactive",
      confirmationStyle: "strict",
      visualEnergy: "vivid",
      guidelines: ["observa antes de actuar", "verifica después de actuar", "deténte ante ambigüedad"],
      greetingStyle: "operativo"
    },
    COMPANION: {
      tone: "warm",
      verbosity: "balanced",
      initiative: "guided",
      confirmationStyle: "minimal",
      visualEnergy: "steady",
      guidelines: ["conserva contexto útil", "habla de forma natural", "no finjas capacidades"],
      greetingStyle: "cercano"
    }
  };

  const base = profileByMode[mode];
  const requestedTone = String(input.tone ?? "").toLowerCase();
  const requestedStyle = String(input.responseStyle ?? "").toLowerCase();
  const tone =
    requestedTone === "warm" || requestedTone === "neutral" || requestedTone === "precise" || requestedTone === "energetic"
      ? requestedTone
      : base.tone;
  const verbosity =
    /concise|breve|corto/.test(requestedStyle) ? "concise" :
    /deep|detall|profund/.test(requestedStyle) ? "deep" :
    base.verbosity;

  return {
    mode,
    tone,
    verbosity,
    initiative: base.initiative,
    confirmationStyle: base.confirmationStyle,
    visualEnergy: base.visualEnergy,
    guidelines: base.guidelines,
    greetingStyle: base.greetingStyle
  };
}
