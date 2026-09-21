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

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("es-PE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreDevice(query: string, device: SmartDevice): DeviceResolutionCandidate {
  const q = normalize(query);
  const name = normalize(device.name);
  let score = 0;
  const reasons: string[] = [];

  if (name === q) {
    score += 100;
    reasons.push("coincidencia exacta de nombre");
  } else if (name && q.includes(name)) {
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
  const familyMatch = aliases.some((alias) => q.includes(normalize(alias)));
  if (familyMatch) {
    score += 30;
    reasons.push("familia coincide");
  }

  const room = typeof device.metadata?.room === "string" ? normalize(device.metadata.room) : "";
  if (room && q.includes(room)) {
    score += 28;
    reasons.push("habitación coincide");
  }

  if (device.online) {
    score += 16;
    reasons.push("dispositivo online");
  } else {
    score -= 45;
    reasons.push("dispositivo offline");
  }

  const protocolPriority: DeviceProtocol[] = ["ANDROID_NATIVE", "DESKTOP_NATIVE", "HOME_ASSISTANT", "MATTER", "GOOGLE_CAST", "CHROMECAST", "MQTT", "HTTP_LOCAL", "BLUETOOTH", "ALEXA_BRIDGE", "IR"];
  score += Math.max(0, 12 - protocolPriority.indexOf(device.protocol));

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

  const [top, second] = viable;
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
