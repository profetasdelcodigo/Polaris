import { PolarisError } from "../../errors.js";

export const deviceProtocols = [
  "MATTER",
  "HOME_ASSISTANT",
  "MQTT",
  "HTTP_LOCAL",
  "CHROMECAST",
  "ANDROID_TV",
  "GOOGLE_CAST",
  "ALEXA_BRIDGE",
  "IR",
  "BLUETOOTH",
  "ANDROID_NATIVE",
  "DESKTOP_NATIVE"
] as const;
export type DeviceProtocol = typeof deviceProtocols[number];

export const deviceFamilies = [
  "LIGHT",
  "SWITCH",
  "PLUG",
  "TV",
  "SPEAKER",
  "ROUTER",
  "PHONE",
  "TABLET",
  "PC",
  "FRIDGE",
  "MICROWAVE",
  "AC",
  "CAMERA",
  "ROBOT",
  "OTHER"
] as const;
export type DeviceFamily = typeof deviceFamilies[number];

export const deviceActions = [
  "ON",
  "OFF",
  "TOGGLE",
  "SET_BRIGHTNESS",
  "SET_COLOR",
  "SET_VOLUME",
  "MUTE",
  "UNMUTE",
  "PLAY",
  "PAUSE",
  "STOP",
  "NEXT",
  "PREVIOUS",
  "OPEN_APP",
  "SET_CHANNEL",
  "SET_INPUT",
  "SET_TEMPERATURE",
  "SET_MODE",
  "LOCK",
  "UNLOCK",
  "REBOOT",
  "IDENTIFY",
  "GET_STATE"
] as const;
export type DeviceAction = typeof deviceActions[number];

export type SmartDevice = {
  id: string;
  name: string;
  family: DeviceFamily;
  protocol: DeviceProtocol;
  online: boolean;
  local: boolean;
  capabilities: readonly DeviceAction[];
  metadata?: Record<string, unknown>;
};

const riskyActions = new Set<DeviceAction>(["REBOOT", "LOCK", "UNLOCK"]);

export function validateDeviceCommand(input: {
  device: SmartDevice;
  action: DeviceAction;
  value?: string | number | boolean;
  confirmed?: boolean;
}) {
  if (!input.device.online) {
    throw new PolarisError("NETWORK_ERROR", "El dispositivo está desconectado.", 409);
  }
  if (!input.device.capabilities.includes(input.action)) {
    throw new PolarisError("NOT_FOUND", `El dispositivo no declara la acción ${input.action}.`, 404);
  }
  if (riskyActions.has(input.action) && input.confirmed !== true) {
    throw new PolarisError("PERMISSION_DENIED", `La acción ${input.action} requiere confirmación explícita.`, 403);
  }

  if (["SET_BRIGHTNESS", "SET_VOLUME"].includes(input.action)) {
    if (typeof input.value !== "number" || input.value < 0 || input.value > 100) {
      throw new PolarisError("VALIDATION_ERROR", "El valor debe ser un porcentaje entre 0 y 100.", 400);
    }
  }

  if (input.action === "SET_TEMPERATURE") {
    if (typeof input.value !== "number" || input.value < 5 || input.value > 35) {
      throw new PolarisError("VALIDATION_ERROR", "La temperatura debe estar entre 5 y 35 °C.", 400);
    }
  }

  return {
    allowed: true,
    requiresConfirmation: riskyActions.has(input.action),
    normalized: {
      deviceId: input.device.id,
      protocol: input.device.protocol,
      family: input.device.family,
      action: input.action,
      ...(input.value !== undefined ? { value: input.value } : {})
    }
  };
}

export function protocolCapabilities(protocol: DeviceProtocol): DeviceAction[] {
  switch (protocol) {
    case "CHROMECAST":
    case "GOOGLE_CAST":
      return ["GET_STATE", "PLAY", "PAUSE", "STOP", "NEXT", "PREVIOUS", "SET_VOLUME", "MUTE", "UNMUTE", "OPEN_APP"];
    case "MATTER":
      return ["GET_STATE", "ON", "OFF", "TOGGLE", "SET_BRIGHTNESS", "SET_COLOR", "SET_TEMPERATURE", "SET_MODE", "IDENTIFY"];
    case "HOME_ASSISTANT":
    case "MQTT":
    case "HTTP_LOCAL":
      return ["GET_STATE", "ON", "OFF", "TOGGLE", "SET_BRIGHTNESS", "SET_COLOR", "SET_VOLUME", "MUTE", "UNMUTE", "PLAY", "PAUSE", "STOP", "NEXT", "PREVIOUS", "OPEN_APP", "SET_CHANNEL", "SET_INPUT", "SET_TEMPERATURE", "SET_MODE", "IDENTIFY"];
    case "ANDROID_NATIVE":
      return ["GET_STATE", "ON", "OFF", "TOGGLE", "OPEN_APP", "SET_VOLUME", "MUTE", "UNMUTE", "PLAY", "PAUSE", "NEXT", "PREVIOUS", "REBOOT"];
    case "DESKTOP_NATIVE":
      return ["GET_STATE", "OPEN_APP", "SET_VOLUME", "MUTE", "UNMUTE", "PLAY", "PAUSE", "NEXT", "PREVIOUS", "REBOOT"];
    case "IR":
    case "BLUETOOTH":
    case "ALEXA_BRIDGE":
      return ["GET_STATE", "ON", "OFF", "TOGGLE", "SET_VOLUME", "MUTE", "UNMUTE", "PLAY", "PAUSE", "STOP", "NEXT", "PREVIOUS", "SET_CHANNEL", "SET_INPUT"];
    default:
      throw new PolarisError("VALIDATION_ERROR", `Protocolo no soportado: ${protocol}`, 400);
  }
}

export function discoverableProtocolMatrix() {
  return deviceProtocols.map(protocol => ({
    protocol,
    actions: protocolCapabilities(protocol),
    note: protocol === "ALEXA_BRIDGE"
      ? "Requiere un puente/API autorizado; Polaris no simula control directo de Alexa."
      : protocol === "IR"
        ? "Requiere hardware IR compatible en el companion."
        : "Requiere un adaptador nativo o gateway compatible."
  }));
}
