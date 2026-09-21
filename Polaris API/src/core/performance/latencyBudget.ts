export interface LatencyBudget {
  totalMs: number;
  researchMs: number;
  executionMs: number;
  responseMs: number;
}

export function createLatencyBudget(mode: "NORMAL" | "URGENT" | "RESEARCH" | "HANDS_FREE"): LatencyBudget {
  if (mode === "URGENT" || mode === "HANDS_FREE") return { totalMs: 8_000, researchMs: 1_000, executionMs: 3_000, responseMs: 2_000 };
  if (mode === "RESEARCH") return { totalMs: 60_000, researchMs: 45_000, executionMs: 8_000, responseMs: 7_000 };
  return { totalMs: 20_000, researchMs: 5_000, executionMs: 8_000, responseMs: 7_000 };
}
