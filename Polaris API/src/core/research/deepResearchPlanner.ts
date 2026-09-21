import crypto from "node:crypto";

export interface ResearchPlan {
  researchId: string;
  question: string;
  subquestions: string[];
  queries: string[];
  sourcePolicy: {
    preferPrimary: boolean;
    requireDateForCurrentClaims: boolean;
    recordPublisher: boolean;
    recordAccessedAt: boolean;
  };
  verification: string[];
  deliverables: string[];
  status: "PLANNED";
}

const normalize = (value: string) =>
  value.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function planDeepResearch(question: string): ResearchPlan {
  const clean = question.trim().slice(0, 6_000);
  const normalized = normalize(clean);
  const subquestions = [
    "¿Cuál es exactamente la afirmación o problema que se debe resolver?",
    "¿Qué fuentes primarias o documentación oficial pueden comprobarlo?",
    "¿Qué datos o contexto temporal cambian la respuesta?",
    "¿Existen fuentes que contradigan o limiten la afirmación?",
    "¿Qué parte de la conclusión es hecho y qué parte es interpretación?"
  ];

  if (/(precio|costo|coste|hoy|actual|latest|último|ultima|última|2026)/.test(normalized)) {
    subquestions.push("¿Qué información es vigente en la fecha de la investigación y qué podría haber cambiado?");
  }

  return {
    researchId: "res_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16),
    question: clean,
    subquestions,
    queries: [
      clean,
      clean + " documentación oficial",
      clean + " datos fuentes primarias",
      clean + " debate evidencia",
      clean + " limitaciones"
    ],
    sourcePolicy: {
      preferPrimary: true,
      requireDateForCurrentClaims: true,
      recordPublisher: true,
      recordAccessedAt: true
    },
    verification: [
      "Separar hechos observables de opiniones y análisis.",
      "Contrastar afirmaciones importantes con más de una fuente cuando sea posible.",
      "Marcar incertidumbre y conflictos entre fuentes en lugar de ocultarlos.",
      "No convertir un resultado de búsqueda en una afirmación verificada automáticamente."
    ],
    deliverables: [
      "Resumen ejecutivo",
      "Hallazgos y evidencia",
      "Contradicciones y límites",
      "Fuentes y fechas",
      "Conclusión condicionada a la evidencia disponible"
    ],
    status: "PLANNED"
  };
}
