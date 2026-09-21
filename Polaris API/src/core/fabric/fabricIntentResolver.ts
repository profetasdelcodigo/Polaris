import type { FabricFunction } from "./capabilityFabric.js";
import { fabricCatalog, getFabricFunction } from "./capabilityFabric.js";

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function platformPrefix(platform?: string): string | undefined {
  if (!platform) return undefined;
  const normalized = platform.toUpperCase();
  return normalized === "DESKTOP" ? "desktop." : normalized === "WEB" ? "web." : normalized === "ANDROID" ? "android." : undefined;
}

export type FabricIntentMatch = {
  function: FabricFunction;
  input?: unknown;
  confidence: number;
  reason: string;
};

const knownServices = [
  "google", "youtube", "github", "gmail", "drive", "docs", "sheets", "slides",
  "calendar", "maps", "meet", "gemini", "discord", "reddit", "wikipedia",
  "x", "facebook", "instagram", "tiktok", "linkedin", "spotify", "netflix",
  "prime-video", "twitch", "canva", "figma", "notion", "slack", "trello",
  "stack-overflow", "mdn", "npm"
];

export function resolveFabricIntent(task: string, preferredDevice?: string): FabricIntentMatch | null {
  const text = normalize(task);
  if (!text) return null;

  const prefix = platformPrefix(preferredDevice);
  const candidates = prefix ? fabricCatalog.filter((item) => item.id.startsWith(prefix)) : fabricCatalog;
  const find = (suffix: string) => candidates.find((item) => item.id === (prefix ?? "") + suffix);
  const findService = (kind: "open" | "search", service: string) =>
    candidates.find((item) =>
      item.id.startsWith((prefix ?? "") + kind + ".service.") &&
      item.id.endsWith("-" + service)
    );
  const matchesService = (requested: string, service: string) =>
    requested === service ||
    requested.startsWith(service + "-") ||
    requested.endsWith("-" + service) ||
    requested.includes("-" + service + "-");

  const openMatch = text.match(/(?:abre|abrir|abreme|abre me|open)\s+(?:el|la|los|las)?\s*(.+)$/i);
  if (openMatch) {
    const requested = normalize(openMatch[1] ?? "").replace(/\s+/g, "-");
    for (const service of knownServices) {
      if (requested.includes(service)) {
        const item = find("open.service.01-" + service) ?? candidates.find((candidate) => candidate.id.includes("open.service") && candidate.id.endsWith("-" + service));
        if (item) return { function: item, confidence: 0.98, reason: "servicio conocido" };
      }
    }
  }

  const searchMatch = text.match(/(?:busca|buscar|search)\s+(?:en\s+)?([a-z0-9\-]+)\s+(.+)$/i);
  if (searchMatch) {
    const service = normalize(searchMatch[1] ?? "").replace(/\s+/g, "-");
    const query = (searchMatch[2] ?? "").trim();
    if (knownServices.includes(service)) {
      const item = findService("search", service);
      if (item) return { function: item, input: query, confidence: 0.99, reason: "búsqueda en servicio conocido" };
    }
  }

  const copyMatch = text.match(/^(?:copia|copiar|copy)\s+(.+)$/i);
  if (copyMatch) {
    const item = candidates.find((candidate) => candidate.id.includes(".copy.slot.01"));
    if (item) return { function: item, input: task.trim().replace(/^(?:copia|copiar|copy)\s+/i, ""), confidence: 0.95, reason: "copiado directo" };
  }

  const waitMatch = text.match(/(?:espera|esperar|wait)\s+(\d+(?:\.\d+)?)\s*(ms|milisegundos|s|segundos|segundo)?/i);
  if (waitMatch) {
    const raw = Number(waitMatch[1]);
    const unit = (waitMatch[2] ?? "ms").toLowerCase();
    const ms = unit === "s" || unit.startsWith("seg") ? raw * 1000 : raw;
    const variant = Math.round(ms / 250);
    if (variant >= 1 && variant <= 16 && Math.abs(ms - variant * 250) <= 1) {
      const item = find("wait." + String(variant).padStart(2, "0"));
      if (item) return { function: item, confidence: 0.97, reason: "espera cuantizada y acotada" };
    }
  }

  if (/^(arriba|ve arriba|ir arriba|scroll arriba)/.test(text)) {
    const item = candidates.find((candidate) => candidate.id.includes(".navigation.top.1"));
    if (item) return { function: item, confidence: 0.94, reason: "navegación al inicio" };
  }
  if (/^(abajo|ve abajo|ir abajo|scroll abajo)/.test(text)) {
    const item = candidates.find((candidate) => candidate.id.includes(".navigation.bottom.1"));
    if (item) return { function: item, confidence: 0.94, reason: "navegación al final" };
  }
  if (/^(enfoca|enfocar|focus).*(chat|mensaje)/.test(text)) {
    const item = candidates.find((candidate) => candidate.id.includes(".focus.chat.1"));
    if (item) return { function: item, confidence: 0.94, reason: "enfoque de chat" };
  }

  return null;
}
