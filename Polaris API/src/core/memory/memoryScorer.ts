export interface MemoryLike {
  content: string;
  category?: string;
  importance?: number;
  updated_at?: string;
}

const normalize = (value: string) => value.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function scoreMemory(query: string, memory: MemoryLike): number {
  const q = new Set(normalize(query).split(/\s+/).filter((word) => word.length > 2));
  const text = normalize(memory.content);
  const tokens = text.split(/\s+/);
  const overlap = tokens.filter((token) => q.has(token)).length;
  const importance = Math.max(0, Math.min(5, memory.importance ?? 3)) * 8;
  const freshness = memory.updated_at ? Math.max(0, 20 - Math.floor(Math.max(0, Date.now() - Date.parse(memory.updated_at)) / 86_400_000)) : 0;
  return Math.min(100, overlap * 10 + importance + freshness);
}

export function rankMemories<T extends MemoryLike>(query: string, memories: readonly T[], limit = 8): T[] {
  return memories
    .map((memory, index) => ({ memory, score: scoreMemory(query, memory), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ memory }) => memory);
}
