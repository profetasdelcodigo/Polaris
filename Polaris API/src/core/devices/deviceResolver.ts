import type { SmartDevice, DeviceFamily, DeviceProtocol } from "./deviceFabric.js";

export type DeviceResolutionCandidate = {
  device: SmartDevice;
  score: number;
  reasons: string[];
};

export type DeviceResolution =
  | {
      status: "RESOLVED";
      device: SmartDevice;
      candidates: DeviceResolutionCandidate[];
    }
  | {
      status: "AMBIGUOUS";
      candidates: DeviceResolutionCandidate[];
      question: string;
    }
  | {
      status: "NOT_FOUND";
      candidates: DeviceResolutionCandidate[];
      question: string;
    };

const familyAliases: Record<DeviceFamily, string[]> = {
  LIGHT: ["luz", "lampara", "lámpara", "foco", "bombilla"],
  SWITCH: ["interruptor"],
  PLUG: ["enchufe", "toma"],
  TV: ["tv", "tele", "televisor", "televisión"],
  SPEAKER: ["parlante", "altavoz", "bocina", "speaker"],
  ROUTER: ["router", "wifi", "internet", "módem", "modem"],
  PHONE: ["telefono", "teléfono", "celular", "movil", "móvil"],
  TABLET: ["tablet"],
  PC: ["pc", "computadora", "ordenador", "laptop"],
  FRIDGE: ["refrigeradora", "refrigerador", "nevera", "fridge"],
  MICROWAVE: ["microondas"],
  AC: ["aire", "aire acondicionado", "ac"],
  CAMERA: ["camara", "cámara"],
  ROBOT: ["robot"],
  OTHER: ["dispositivo"]
};

const roomAliases: Record<string, string[]> = {
  dormitorio: ["dormitorio", "cuarto", "habitacion", "habitación", "recamara", "recámara"],
  sala: ["sala", "salon", "salón", "living"],
  cocina: ["cocina"],
  bano: ["baño", "bano", "servicio"],
  oficina: ["oficina", "estudio", "despacho"],
  comedor: ["comedor"],
  patio: ["patio", "jardin", "jardín"],
  garaje: ["garaje", "cochera"],
  entrada: ["entrada", "recibidor"]
};

const protocolPriority: DeviceProtocol[] = [
  "ANDROID_NATIVE",
  "DESKTOP_NATIVE",
  "HOME_ASSISTANT",
  "MATTER",
  "GOOGLE_CAST",
  "CHROMECAST",
  "MQTT",
  "HTTP_LOCAL",
  "BLUETOOTH",
  "ALEXA_BRIDGE",
  "IR"
];

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(query: string, phrase: string): boolean {
  return query === phrase || query.includes(` ${phrase} `) || query.startsWith(`${phrase} `) || query.endsWith(` ${phrase}`);
}

function metadataString(device: SmartDevice, key: string): string {
  const value = device.metadata?.[key];
  return typeof value === "string" ? normalize(value) : "";
}

function scoreRecency(device: SmartDevice): { score: number; reason?: string } {
  const lastUsedAt = metadataString(device, "lastUsedAt");
  if (!lastUsedAt) return { score: 0 };

  const timestamp = Date.parse(lastUsedAt);
  if (!Number.isFinite(timestamp)) return { score: 0 };

  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageHours = ageMs / 3_600_000;
  if (ageHours <= 1) return { score: 14, reason: "usado recientemente" };
  if (ageHours <= 24) return { score: 9, reason: "usado hoy" };
  if (ageHours <= 168) return { score: 4, reason: "usado esta semana" };
  return { score: 0 };
}

function scoreDevice(query: string, device: SmartDevice): DeviceResolutionCandidate {
  const q = normalize(query);
  const name = normalize(device.name);
  let score = 0;
  const reasons: string[] = [];

  if (name === q) {
    score += 100;
    reasons.push("coincidencia exacta de nombre");
  } else if (name && hasPhrase(q, name)) {
    score += 72;
    reasons.push("nombre contenido en la petición");
  } else {
    const nameTokens = new Set(name.split(" ").filter(Boolean));
    const matches = q.split(" ").filter((token) => nameTokens.has(token));
    if (matches.length) {
      score += Math.min(55, matches.length * 18);
      reasons.push("tokens del nombre coinciden");
    }
  }

  const aliases = familyAliases[device.family] ?? [];
  const familyMatch = aliases.some((alias) => hasPhrase(q, normalize(alias)));
  if (familyMatch) {
    score += 30;
    reasons.push("familia coincide");
  }

  const room = metadataString(device, "room");
  if (room && hasPhrase(q, room)) {
    score += 28;
    reasons.push("habitación coincide");
  } else if (room) {
    const normalizedRoom = Object.entries(roomAliases).find(([, aliases]) =>
      aliases.some((alias) => normalize(alias) === room)
    )?.[0];
    if (normalizedRoom && (roomAliases[normalizedRoom] ?? []).some((alias) => hasPhrase(q, normalize(alias)))) {
      score += 28;
      reasons.push("habitación coincide");
    }
  }

  const zone = metadataString(device, "zone");
  if (zone && hasPhrase(q, zone)) {
    score += 12;
    reasons.push("zona coincide");
  }

  if (device.online) {
    score += 16;
    reasons.push("dispositivo online");
  } else {
    score -= 45;
    reasons.push("dispositivo offline");
  }

  const recency = scoreRecency(device);
  score += recency.score;
  if (recency.reason) reasons.push(recency.reason);

  if (device.metadata?.favorite === true) {
    score += 3;
    reasons.push("dispositivo favorito");
  }

  const protocolIndex = protocolPriority.indexOf(device.protocol);
  score += protocolIndex >= 0 ? Math.max(0, 12 - protocolIndex) : 0;

  return { device, score, reasons };
}

export function resolveDeviceReference(query: string, devices: SmartDevice[]): DeviceResolution {
  const candidates = devices
    .map((device) => scoreDevice(query, device))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const viable = candidates.filter((candidate) => candidate.score >= 30);
  if (!viable.length) {
    return {
      status: "NOT_FOUND",
      candidates,
      question: "No identifiqué un dispositivo suficientemente claro. Dime el nombre o la habitación del dispositivo."
    };
  }

  const top = viable[0];
  const second = viable[1];
  if (!top) {
    return {
      status: "NOT_FOUND",
      candidates,
      question: "No pude seleccionar un dispositivo seguro."
    };
  }

  if (top.score >= 85 && (!second || top.score - second.score >= 18)) {
    return { status: "RESOLVED", device: top.device, candidates };
  }

  return {
    status: "AMBIGUOUS",
    candidates: viable,
    question: second
      ? `Encontré más de una opción: “${top.device.name}” y “${second.device.name}”. ¿Cuál quieres usar?`
      : "Encontré el dispositivo, pero necesito un detalle adicional para estar seguro."
  };
}
