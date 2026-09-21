export type ResponseMode = "ANSWER" | "ACTION" | "RESEARCH" | "CONFIRM" | "ERROR";

export interface PolarisResponseContract {
  mode: ResponseMode;
  answer: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  action?: { capability: string; requiresConfirmation: boolean };
  sources?: { title: string; url?: string; publisher?: string }[];
  uncertainty?: string[];
}

export function normalizeResponseContract(input: Partial<PolarisResponseContract>): PolarisResponseContract {
  return {
    mode: input.mode ?? "ANSWER",
    answer: (input.answer ?? "").trim().slice(0, 30_000),
    ...(input.confidence ? { confidence: input.confidence } : {}),
    ...(input.action ? { action: input.action } : {}),
    ...(input.sources ? { sources: input.sources.slice(0, 20) } : {}),
    ...(input.uncertainty ? { uncertainty: input.uncertainty.slice(0, 20) } : {})
  };
}
