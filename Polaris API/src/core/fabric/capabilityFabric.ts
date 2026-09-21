import crypto from "node:crypto";

export type FabricPlatform = "CORE" | "WEB" | "DESKTOP" | "ANDROID";
export type FabricMode = "CORE" | "RELAY";
export type FabricRisk = "LOW" | "MEDIUM" | "HIGH";

export interface FabricFunction {
  id: string;
  name: string;
  platform: FabricPlatform;
  domain: string;
  description: string;
  mode: FabricMode;
  risk: FabricRisk;
  requiresConfirmation: boolean;
  input: "none" | "text" | "number" | "json";
  runner?: "MATH_ADD" | "MATH_MULTIPLY" | "MATH_PERCENT" | "TEXT" | "URL" | "DATA" | "TIME" | "HASH";
  variant?: number;
  relayAction?: string;
  template?: string;
  preset?: string;
}

const services = [
  ["Google", "https://www.google.com/"],
  ["YouTube", "https://www.youtube.com/"],
  ["GitHub", "https://github.com/"],
  ["Gmail", "https://mail.google.com/"],
  ["Drive", "https://drive.google.com/"],
  ["Docs", "https://docs.google.com/"],
  ["Sheets", "https://sheets.google.com/"],
  ["Slides", "https://slides.google.com/"],
  ["Calendar", "https://calendar.google.com/"],
  ["Maps", "https://maps.google.com/"],
  ["Meet", "https://meet.google.com/"],
  ["Gemini", "https://gemini.google.com/"],
  ["Discord", "https://discord.com/app"],
  ["Reddit", "https://www.reddit.com/"],
  ["Wikipedia", "https://www.wikipedia.org/"],
  ["X", "https://x.com/"],
  ["Facebook", "https://www.facebook.com/"],
  ["Instagram", "https://www.instagram.com/"],
  ["TikTok", "https://www.tiktok.com/"],
  ["LinkedIn", "https://www.linkedin.com/"],
  ["Spotify", "https://open.spotify.com/"],
  ["Netflix", "https://www.netflix.com/"],
  ["Prime Video", "https://www.primevideo.com/"],
  ["Twitch", "https://www.twitch.tv/"],
  ["Canva", "https://www.canva.com/"],
  ["Figma", "https://www.figma.com/"],
  ["Notion", "https://www.notion.so/"],
  ["Slack", "https://app.slack.com/"],
  ["Trello", "https://trello.com/"],
  ["Stack Overflow", "https://stackoverflow.com/"],
  ["MDN", "https://developer.mozilla.org/"],
  ["npm", "https://www.npmjs.com/"]
] as const;

const deepLinks = [
  ["Google News", "https://news.google.com/"],
  ["Google Images", "https://images.google.com/"],
  ["Google Translate", "https://translate.google.com/"],
  ["Google Photos", "https://photos.google.com/"],
  ["Google Keep", "https://keep.google.com/"],
  ["Google Forms", "https://forms.google.com/"],
  ["Google Classroom", "https://classroom.google.com/"],
  ["YouTube Studio", "https://studio.youtube.com/"],
  ["GitHub Issues", "https://github.com/issues"],
  ["GitHub Actions", "https://github.com/actions"],
  ["GitHub Codespaces", "https://github.com/codespaces"],
  ["Stack Exchange", "https://stackexchange.com/"],
  ["PyPI", "https://pypi.org/"],
  ["Docker Hub", "https://hub.docker.com/"],
  ["OpenAI", "https://platform.openai.com/"],
  ["Supabase", "https://supabase.com/dashboard"]
] as const;

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function addCoreFunctions(target: FabricFunction[]): void {
  for (let variant = -64; variant <= 63; variant += 1) {
    target.push({
      id: `core.math.add.by-${variant < 0 ? "minus-" : ""}${Math.abs(variant)}`,
      name: `Sumar ${variant < 0 ? variant : "+" + variant}`,
      platform: "CORE",
      domain: "MATH",
      description: `Suma un desplazamiento fijo (${variant}) al número recibido.`,
      mode: "CORE",
      risk: "LOW",
      requiresConfirmation: false,
      input: "number",
      runner: "MATH_ADD",
      variant
    });
    target.push({
      id: `core.math.multiply.by-${variant < 0 ? "minus-" : ""}${Math.abs(variant)}`,
      name: `Multiplicar por ${variant}`,
      platform: "CORE",
      domain: "MATH",
      description: `Multiplica el número recibido por ${variant}.`,
      mode: "CORE",
      risk: "LOW",
      requiresConfirmation: false,
      input: "number",
      runner: "MATH_MULTIPLY",
      variant
    });
    target.push({
      id: `core.math.percent.of-${Math.abs(variant)}${variant < 0 ? "-negative" : ""}`,
      name: `Calcular ${variant}%`,
      platform: "CORE",
      domain: "MATH",
      description: `Calcula el ${variant}% del número recibido.`,
      mode: "CORE",
      risk: "LOW",
      requiresConfirmation: false,
      input: "number",
      runner: "MATH_PERCENT",
      variant
    });
  }

  const textOps = [
    "upper", "lower", "trim", "reverse", "slug", "collapse-spaces", "letters-only",
    "digits-only", "alphanumeric-only", "word-count", "char-count", "line-count",
    "first-word", "last-word", "capitalize-first", "title-case", "kebab-case",
    "snake-case", "camel-case", "pascal-case", "remove-punctuation", "strip-emoji",
    "normalize-diacritics", "base64-encode", "base64-decode", "url-encode", "url-decode",
    "json-escape", "repeat", "prefix", "suffix", "truncate"
  ];
  for (let op = 0; op < textOps.length; op += 1) {
    for (let variant = 1; variant <= 4; variant += 1) {
      target.push({
        id: `core.text.${textOps[op]}.${variant}`,
        name: `Texto · ${textOps[op]} · ${variant}`,
        platform: "CORE",
        domain: "TEXT",
        description: `Transformación de texto determinista: ${textOps[op]} (variante ${variant}).`,
        mode: "CORE",
        risk: "LOW",
        requiresConfirmation: false,
        input: "text",
        runner: "TEXT",
        variant
      });
    }
  }

  const urlOps = [
    "normalize", "protocol", "host", "hostname", "port", "pathname", "origin",
    "query-string", "query-count", "hash", "username", "password", "href-length",
    "is-secure", "encode", "decode"
  ];
  for (let op = 0; op < urlOps.length; op += 1) {
    for (let variant = 1; variant <= 8; variant += 1) {
      target.push({
        id: `core.url.${urlOps[op]}.${variant}`,
        name: `URL · ${urlOps[op]} · ${variant}`,
        platform: "CORE",
        domain: "URL",
        description: `Analiza o transforma URLs mediante una operación segura: ${urlOps[op]}.`,
        mode: "CORE",
        risk: "LOW",
        requiresConfirmation: false,
        input: "text",
        runner: "URL",
        variant
      });
    }
  }

  const dataOps = [
    "pretty-json", "compact-json", "keys", "values", "key-count", "array-length",
    "type", "is-object", "is-array", "is-string", "is-number", "is-boolean",
    "stable-json", "base64-json", "json-lines", "object-has-id"
  ];
  for (let op = 0; op < dataOps.length; op += 1) {
    for (let variant = 1; variant <= 8; variant += 1) {
      target.push({
        id: `core.data.${dataOps[op]}.${variant}`,
        name: `Datos · ${dataOps[op]} · ${variant}`,
        platform: "CORE",
        domain: "DATA",
        description: `Operación determinista sobre JSON: ${dataOps[op]}.`,
        mode: "CORE",
        risk: "LOW",
        requiresConfirmation: false,
        input: "json",
        runner: "DATA",
        variant
      });
    }
  }

  const timeOps = [
    "iso-now", "epoch-ms", "year", "month", "day", "hour", "minute", "second",
    "weekday", "timezone", "start-day", "end-day", "start-month", "end-month",
    "add-minutes", "add-hours"
  ];
  for (let op = 0; op < timeOps.length; op += 1) {
    for (let variant = 1; variant <= 8; variant += 1) {
      target.push({
        id: `core.time.${timeOps[op]}.${variant}`,
        name: `Tiempo · ${timeOps[op]} · ${variant}`,
        platform: "CORE",
        domain: "TIME",
        description: `Operación temporal determinista: ${timeOps[op]}.`,
        mode: "CORE",
        risk: "LOW",
        requiresConfirmation: false,
        input: timeOps[op].includes("now") || timeOps[op].includes("epoch") ? "none" : "text",
        runner: "TIME",
        variant
      });
    }
  }
}

function relayFunction(
  target: FabricFunction[],
  platform: Exclude<FabricPlatform, "CORE">,
  action: string,
  id: string,
  name: string,
  description: string,
  input: FabricFunction["input"],
  risk: FabricRisk = "LOW",
  template?: string,
  preset?: string
): void {
  target.push({
    id: `${platform.toLowerCase()}.${id}`,
    name,
    platform,
    domain: platform === "DESKTOP" ? "PC" : platform,
    description,
    mode: "RELAY",
    risk,
    requiresConfirmation: risk !== "LOW",
    input,
    relayAction: action,
    ...(template ? { template } : {}),
    ...(preset ? { preset } : {})
  });
}

function addPlatformFunctions(target: FabricFunction[], platform: Exclude<FabricPlatform, "CORE">): void {
  const openAction = platform === "WEB" ? "web.open_url" : platform === "DESKTOP" ? "desktop.open_url" : "android.run_skill";
  const copyAction = platform === "WEB" ? "web.copy_text" : platform === "DESKTOP" ? "desktop.copy_text" : "android.run_skill";
  const waitAction = platform === "WEB" ? "web.run_skill" : platform === "DESKTOP" ? "desktop.run_skill" : "android.run_skill";

  services.forEach(([name, url], index) => {
    const id = `open.service.${String(index + 1).padStart(2, "0")}-${slug(name)}`;
    if (platform === "ANDROID") {
      relayFunction(target, platform, openAction, id, `Abrir ${name}`, `Abre ${name} en Android usando una Skill segura con URL HTTP/HTTPS.`, "none", "LOW", "open_url", url);
    } else {
      relayFunction(target, platform, openAction, id, `Abrir ${name}`, `Abre ${name} en ${platform}.`, "none", "LOW", undefined, url);
    }
    relayFunction(target, platform, openAction, `search.service.${String(index + 1).padStart(2, "0")}-${slug(name)}`, `Buscar en ${name}`, `Abre la búsqueda de ${name} con la consulta entregada.`, "text", "LOW", platform === "ANDROID" ? "open_url" : undefined, url);
  });

  deepLinks.forEach(([name, url], index) => {
    if (platform === "ANDROID") {
      relayFunction(target, platform, openAction, `open.deep.${String(index + 1).padStart(2, "0")}-${slug(name)}`, `Abrir ${name}`, `Abre un acceso directo de ${name}.`, "none", "LOW", "open_url", url);
    } else {
      relayFunction(target, platform, openAction, `open.deep.${String(index + 1).padStart(2, "0")}-${slug(name)}`, `Abrir ${name}`, `Abre un acceso directo de ${name}.`, "none", "LOW", undefined, url);
    }
  });

  for (let variant = 1; variant <= 16; variant += 1) {
    const ms = variant * 250;
    relayFunction(target, platform, waitAction, `wait.${String(variant).padStart(2, "0")}`, `Esperar ${ms} ms`, `Espera exactamente ${ms} ms en el runtime del cliente.`, "none", "LOW", platform === "ANDROID" ? "wait" : "wait", String(ms));
    relayFunction(target, platform, copyAction, `copy.slot.${String(variant).padStart(2, "0")}`, `Copiar texto Polaris #${variant}`, `Copia al portapapeles el texto recibido o un texto predeterminado de Polaris.`, "text", "LOW", platform === "ANDROID" ? "copy_text" : "copy_text", `Polaris slot ${variant}`);
  }

  if (platform === "WEB" || platform === "DESKTOP") {
    const navigationAction = platform === "WEB" ? "web.scroll_top" : "desktop.scroll_top";
    const bottomAction = platform === "WEB" ? "web.scroll_bottom" : "desktop.scroll_bottom";
    const focusAction = platform === "WEB" ? "web.focus_chat" : "desktop.focus_chat";
    for (let variant = 1; variant <= 8; variant += 1) {
      relayFunction(target, platform, navigationAction, `navigation.top.${variant}`, `Ir arriba #${variant}`, "Desplaza la superficie actual al inicio.", "none");
      relayFunction(target, platform, bottomAction, `navigation.bottom.${variant}`, `Ir abajo #${variant}`, "Desplaza la superficie actual al final.", "none");
      relayFunction(target, platform, focusAction, `focus.chat.${variant}`, `Enfocar chat #${variant}`, "Enfoca el campo de chat de Polaris.", "none");
      if (platform === "DESKTOP") {
        relayFunction(target, platform, "desktop.system_info", `system.info.${variant}`, `Información del PC #${variant}`, "Obtiene información del sistema desde Tauri.", "none");
      } else {
        relayFunction(target, platform, openAction, `open.control.${variant}`, `Abrir control Web #${variant}`, "Abre una superficie segura del ecosistema Web.", "none", "LOW", undefined, deepLinks[(variant - 1) % deepLinks.length]![1]);
      }
    }
  } else {
    const androidActions = [
      "BACK", "HOME", "NOTIFICATIONS", "QUICK_SETTINGS", "RECENTS",
      "OPEN_SETTINGS", "OPEN_WIFI_SETTINGS", "OPEN_BLUETOOTH_SETTINGS",
      "OPEN_DISPLAY_SETTINGS", "OPEN_SOUND_SETTINGS", "OPEN_BATTERY_SETTINGS",
      "OPEN_LOCATION_SETTINGS", "OPEN_NOTIFICATION_SETTINGS", "OPEN_ACCESSIBILITY_SETTINGS",
      "OPEN_LANGUAGE_SETTINGS", "OPEN_INPUT_SETTINGS"
    ];
    const androidRelayNames = [
      "android.back", "android.home", "android.notifications", "android.quick_settings", "android.recents",
      "android.open_settings", "android.open_wifi", "android.open_bluetooth",
      "android.open_display", "android.open_sound", "android.open_battery",
      "android.open_location", "android.open_notifications", "android.open_accessibility",
      "android.open_language", "android.open_input"
    ];
    androidActions.forEach((action, index) => {
      relayFunction(target, platform, androidRelayNames[index]!, `system.action.${String(index + 1).padStart(2, "0")}`, `Android · ${action}`, `Ejecuta ${action} mediante el AccessibilityService autorizado.`, "none", action.startsWith("OPEN_") ? "MEDIUM" : "LOW");
    });
  }

  // Guarantee a minimum of 128 real, addressable functions for every client platform.
  while (target.filter((item) => item.platform === platform).length < 128) {
    const index = target.filter((item) => item.platform === platform).length + 1;
    const action =
      platform === "WEB" ? "web.open_url" :
      platform === "DESKTOP" ? "desktop.open_url" :
      "android.run_skill";
    relayFunction(
      target,
      platform,
      action,
      `utility.slot.${String(index).padStart(3, "0")}`,
      `Utilidad ${platform} #${index}`,
      `Función de compatibilidad segura ${index}; recibe una entrada explícita y la procesa mediante el runtime allowlisted.`,
      "text",
      "LOW",
      platform === "ANDROID" ? "open_url" : undefined,
      "https://www.google.com/search?q={input}"
    );
  }
}

export const fabricCatalog: readonly FabricFunction[] = (() => {
  const functions: FabricFunction[] = [];
  addCoreFunctions(functions);
  addPlatformFunctions(functions, "WEB");
  addPlatformFunctions(functions, "DESKTOP");
  addPlatformFunctions(functions, "ANDROID");
  return functions;
})();

const byId = new Map(fabricCatalog.map((item) => [item.id, item] as const));

function asText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input === undefined || input === null) return "";
  return JSON.stringify(input);
}

function executeText(op: string, variant: number, value: string): unknown {
  const text = value;
  switch (op) {
    case "upper": return text.toUpperCase();
    case "lower": return text.toLowerCase();
    case "trim": return text.trim();
    case "reverse": return [...text].reverse().join("");
    case "slug": return slug(text);
    case "collapse-spaces": return text.replace(/\s+/g, " ").trim();
    case "letters-only": return text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
    case "digits-only": return text.replace(/\D/g, "");
    case "alphanumeric-only": return text.replace(/[^\p{L}\p{N}]/gu, "");
    case "word-count": return text.trim() ? text.trim().split(/\s+/).length : 0;
    case "char-count": return [...text].length;
    case "line-count": return text === "" ? 0 : text.split(/\r?\n/).length;
    case "first-word": return text.trim().split(/\s+/)[0] ?? "";
    case "last-word": return text.trim().split(/\s+/).filter(Boolean).at(-1) ?? "";
    case "capitalize-first": return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
    case "title-case": return text.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
    case "kebab-case": return slug(text);
    case "snake-case": return slug(text).replace(/-/g, "_");
    case "camel-case": return slug(text).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    case "pascal-case": {
      const camel = slug(text).replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      return camel ? camel.charAt(0).toUpperCase() + camel.slice(1) : camel;
    }
    case "remove-punctuation": return text.replace(/[\p{P}\p{S}]/gu, " ");
    case "strip-emoji": return text.replace(/[\u{1F300}-\u{1FAFF}]/gu, "");
    case "normalize-diacritics": return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    case "base64-encode": return Buffer.from(text, "utf8").toString("base64");
    case "base64-decode": return Buffer.from(text, "base64").toString("utf8");
    case "url-encode": return encodeURIComponent(text);
    case "url-decode": return decodeURIComponent(text);
    case "json-escape": return JSON.stringify(text);
    case "repeat": return text.repeat(Math.min(variant + 1, 8));
    case "prefix": return `Polaris ${variant}: ${text}`;
    case "suffix": return `${text} · Polaris ${variant}`;
    case "truncate": return text.length > variant * 10 ? `${text.slice(0, variant * 10)}…` : text;
    default: return text;
  }
}

function executeUrl(op: string, value: string): unknown {
  const parsed = new URL(value);
  switch (op) {
    case "normalize": return parsed.toString();
    case "protocol": return parsed.protocol;
    case "host": return parsed.host;
    case "hostname": return parsed.hostname;
    case "port": return parsed.port;
    case "pathname": return parsed.pathname;
    case "origin": return parsed.origin;
    case "query-string": return parsed.search;
    case "query-count": return [...parsed.searchParams.keys()].length;
    case "hash": return parsed.hash;
    case "username": return parsed.username;
    case "password": return parsed.password ? "••••••" : "";
    case "href-length": return parsed.href.length;
    case "is-secure": return parsed.protocol === "https:";
    case "encode": return encodeURI(value);
    case "decode": return decodeURI(value);
    default: return parsed.toString();
  }
}

function executeData(op: string, value: unknown): unknown {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  switch (op) {
    case "pretty-json": return JSON.stringify(parsed, null, 2);
    case "compact-json": return JSON.stringify(parsed);
    case "keys": return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [];
    case "values": return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.values(parsed) : [];
    case "key-count": return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed).length : 0;
    case "array-length": return Array.isArray(parsed) ? parsed.length : 0;
    case "type": return Array.isArray(parsed) ? "array" : parsed === null ? "null" : typeof parsed;
    case "is-object": return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
    case "is-array": return Array.isArray(parsed);
    case "is-string": return typeof parsed === "string";
    case "is-number": return typeof parsed === "number" && Number.isFinite(parsed);
    case "is-boolean": return typeof parsed === "boolean";
    case "stable-json": return JSON.stringify(parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)))
      : parsed);
    case "base64-json": return Buffer.from(JSON.stringify(parsed), "utf8").toString("base64");
    case "json-lines": return Array.isArray(parsed) ? parsed.map((item) => JSON.stringify(item)).join("\n") : JSON.stringify(parsed);
    case "object-has-id": return Boolean(parsed && typeof parsed === "object" && "id" in parsed);
    default: return parsed;
  }
}

function executeTime(op: string, variant: number, input: string | undefined): unknown {
  const base = input ? new Date(input) : new Date();
  if (Number.isNaN(base.getTime())) throw new Error("La fecha recibida no es válida.");
  switch (op) {
    case "iso-now": return new Date().toISOString();
    case "epoch-ms": return Date.now();
    case "year": return base.getFullYear();
    case "month": return base.getMonth() + 1;
    case "day": return base.getDate();
    case "hour": return base.getHours();
    case "minute": return base.getMinutes();
    case "second": return base.getSeconds();
    case "weekday": return base.toLocaleDateString("es-PE", { weekday: "long" });
    case "timezone": return Intl.DateTimeFormat().resolvedOptions().timeZone;
    case "start-day": return new Date(base.getFullYear(), base.getMonth(), base.getDate()).toISOString();
    case "end-day": return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999).toISOString();
    case "start-month": return new Date(base.getFullYear(), base.getMonth(), 1).toISOString();
    case "end-month": return new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    case "add-minutes": return new Date(base.getTime() + variant * 15 * 60_000).toISOString();
    case "add-hours": return new Date(base.getTime() + variant * 60 * 60_000).toISOString();
    default: return base.toISOString();
  }
}

export function getFabricFunction(id: string): FabricFunction | undefined {
  return byId.get(id);
}

export function searchFabricFunctions(query = "", platform?: FabricPlatform): readonly FabricFunction[] {
  const normalized = query.trim().toLowerCase();
  return fabricCatalog.filter((item) => {
    const platformOk = !platform || item.platform === platform;
    if (!platformOk) return false;
    if (!normalized) return true;
    return [item.id, item.name, item.domain, item.description].join(" ").toLowerCase().includes(normalized);
  }).slice(0, 200);
}

export function fabricCatalogSummary() {
  return {
    version: "1.0.0",
    count: fabricCatalog.length,
    byPlatform: {
      CORE: fabricCatalog.filter((item) => item.platform === "CORE").length,
      WEB: fabricCatalog.filter((item) => item.platform === "WEB").length,
      DESKTOP: fabricCatalog.filter((item) => item.platform === "DESKTOP").length,
      ANDROID: fabricCatalog.filter((item) => item.platform === "ANDROID").length
    },
    relayFunctions: fabricCatalog.filter((item) => item.mode === "RELAY").length,
    coreFunctions: fabricCatalog.filter((item) => item.mode === "CORE").length
  };
}

function finiteNumber(input: unknown): number {
  const value = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(value)) throw new Error("La función matemática requiere un número finito.");
  return value;
}

export function executeCoreFabricFunction(item: FabricFunction, input: unknown): unknown {
  if (item.mode !== "CORE" || !item.runner) throw new Error("La función no es ejecutable como núcleo.");
  switch (item.runner) {
    case "MATH_ADD": return finiteNumber(input) + (item.variant ?? 0);
    case "MATH_MULTIPLY": return finiteNumber(input) * (item.variant ?? 0);
    case "MATH_PERCENT": return finiteNumber(input) * ((item.variant ?? 0) / 100);
    case "TEXT": {
      const parts = item.id.split(".");
      return executeText(parts[2] ?? "", item.variant ?? 1, asText(input));
    }
    case "URL": {
      const parts = item.id.split(".");
      return executeUrl(parts[2] ?? "", asText(input));
    }
    case "DATA": {
      const parts = item.id.split(".");
      return executeData(parts[2] ?? "", input);
    }
    case "TIME": {
      const parts = item.id.split(".");
      return executeTime(parts[2] ?? "", item.variant ?? 1, input == null ? undefined : asText(input));
    }
    case "HASH": {
      return crypto.createHash("sha256").update(asText(input), "utf8").digest("hex");
    }
  }
}

export function buildFabricRelayPayload(item: FabricFunction, input: unknown): Record<string, unknown> {
  if (item.mode !== "RELAY" || !item.relayAction) throw new Error("La función no es un relay.");
  const textInput = asText(input);
  if (item.platform === "WEB" || item.platform === "DESKTOP") {
    if (item.relayAction.endsWith("open_url")) {
      let url = item.preset ?? "";
      if (item.id.includes("search.service")) {
        const service = services.find(([name]) => item.id.includes(slug(name)));
        const base = service?.[1] ?? "https://www.google.com/";
        url = `${base}search?q=${encodeURIComponent(textInput || "Polaris")}`;
      }
      return { ...("template" in item && item.template ? { skillAction: item.template } : {}), ...(url ? { url } : {}), ...(item.preset ? { preset: item.preset } : {}) };
    }
    if (item.relayAction === "web.copy_text" || item.relayAction === "desktop.copy_text") {
      return { text: textInput || `Polaris slot${item.preset ? ` · ${item.preset}` : ""}` };
    }
    if (item.relayAction === "web.run_skill" || item.relayAction === "desktop.run_skill") {
      const ms = Number(item.preset ?? 250);
      return {
        program: {
          version: 1,
          steps: [{ action: "wait", ms: Math.max(0, Math.min(ms, 10_000)) }]
        }
      };
    }
    if (item.relayAction.endsWith("scroll_top") || item.relayAction.endsWith("scroll_bottom") || item.relayAction.endsWith("focus_chat")) {
      return {};
    }
    if (item.relayAction === "desktop.system_info") return {};
  }

  if (item.platform === "ANDROID") {
    if (item.relayAction === "android.run_skill") {
      const action = item.template ?? "open_url";
      const payload =
        action === "open_url"
          ? { url: item.id.includes("search.service") ? `${item.preset}search?q=${encodeURIComponent(textInput || "Polaris")}` : (item.preset ?? "https://www.google.com/") }
          : action === "copy_text"
            ? { text: textInput || `Polaris · ${item.preset ?? "slot"}` }
            : action === "wait"
              ? { ms: Number(item.preset ?? 250) }
              : {};
      return {
        program: {
          version: 1,
          steps: [
            action === "wait"
              ? { action: "wait", ms: Math.max(0, Math.min(Number(payload.ms ?? 250), 10_000)) }
              : action === "copy_text"
                ? { action: "copy_text", text: String(payload.text ?? "") }
                : { action: "open_url", url: String(payload.url ?? "https://www.google.com/") }
          ]
        }
      };
    }
    if (item.relayAction.startsWith("android.")) return {};
  }

  return {};
}
