import crypto from "node:crypto";

export type MemoryLifecycle = "NEW" | "REINFORCED" | "CONFLICTING" | "STALE" | "ARCHIVED";

export type MemoryLike = {
  id?: string;
  content: string;
  category: string;
  importance?: number;
  source?: string;
  created_at?: string;
  updated_at?: string;
};

export type MemoryLifecycleResult = {
  canonical: string;
  fingerprint: string;
  state: MemoryLifecycle;
  confidence: number;
  reason: string;
  duplicateOf?: string;
};

function canonicalize(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.。!！]+$/g, "")
    .toLocaleLowerCase("es-PE");
}

function fingerprint(value: string): string {
  return crypto.createHash("sha256").update(canonicalize(value)).digest("hex").slice(0, 20);
}

function tokenSet(value: string): Set<string> {
  return new Set(canonicalize(value).split(/\W+/u).filter((token) => token.length > 2));
}

function similarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / new Set([...left, ...right]).size;
}

function isRecent(value?: string): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp < 1000 * 60 * 60 * 24 * 45;
}

export function evaluateMemoryLifecycle(candidate: MemoryLike, existing: MemoryLike[]): MemoryLifecycleResult {
  const canonical = canonicalize(candidate.content);
  const exact = existing.find((memory) => canonicalize(memory.content) === canonical);
  if (exact) {
    return {
      canonical,
      fingerprint: fingerprint(canonical),
      state: "REINFORCED",
      confidence: 1,
      reason: "Coincide con una memoria existente.",
      ...(exact.id ? { duplicateOf: exact.id } : {})
    };
  }

  const nearest = existing
    .map((memory) => ({ memory, score: similarity(candidate.content, memory.content) }))
    .sort((a, b) => b.score - a.score)[0];

  if (nearest && nearest.score >= 0.84 && candidate.category === nearest.memory.category) {
    return {
      canonical,
      fingerprint: fingerprint(canonical),
      state: "REINFORCED",
      confidence: nearest.score,
      reason: "Es una reformulación muy cercana de una memoria existente.",
      ...(nearest.memory.id ? { duplicateOf: nearest.memory.id } : {})
    };
  }

  const categoryConflict = existing.some(
    (memory) =>
      memory.category === candidate.category &&
      similarity(candidate.content, memory.content) >= 0.35 &&
      canonicalize(memory.content) !== canonical
  );

  if (categoryConflict) {
    return {
      canonical,
      fingerprint: fingerprint(canonical),
      state: "CONFLICTING",
      confidence: 0.62,
      reason: "Puede contradecir una memoria previa de la misma categoría."
    };
  }

  if (candidate.updated_at && !isRecent(candidate.updated_at) && (candidate.importance ?? 3) <= 2) {
    return {
      canonical,
      fingerprint: fingerprint(canonical),
      state: "STALE",
      confidence: 0.55,
      reason: "La memoria existente asociada al candidato parece antigua y de baja importancia."
    };
  }

  return {
    canonical,
    fingerprint: fingerprint(canonical),
    state: "NEW",
    confidence: 0.78,
    reason: "No se encontró una coincidencia suficiente."
  };
}

export function buildMemoryLifecycleReport(candidate: MemoryLike, existing: MemoryLike[]) {
  const result = evaluateMemoryLifecycle(candidate, existing);
  return {
    ...result,
    nextAction:
      result.state === "NEW" ? "PERSIST" :
      result.state === "REINFORCED" ? "TOUCH" :
      result.state === "CONFLICTING" ? "ASK_USER" :
      result.state === "STALE" ? "REVIEW" :
      "IGNORE"
  };
}
