import { PolarisError } from "../../errors.js";
import type { DeviceAction, DeviceFamily } from "./deviceFabric.js";

export type DeviceIntent = {
  family: DeviceFamily;
  action: DeviceAction;
  value?: number | string;
  confidence: number;
  needsDeviceResolution: true;
};

const familyPatterns: Array<[DeviceFamily, RegExp]> = [
  ["LIGHT", /luz|foco|bombilla|lampara|lámpara/i],
  ["TV", /tele|televisor|tv|pantalla/i],
  ["PC", /pc|computadora|ordenador|laptop/i],
  ["PHONE", /celular|móvil|movil|telefono|teléfono/i],
  ["FRIDGE", /refrigerador|nevera|frigorífico|frigorifico/i],
  ["MICROWAVE", /microondas/i],
  ["AC", /aire acondicionado|aire|clima/i],
  ["SPEAKER", /altavoz|parlante|bocina|speaker/i],
  ["PLUG", /enchufe|tomacorriente/i],
  ["ROUTER", /router|wifi|wi-fi/i]
];

export function parseDeviceIntent(text: string): DeviceIntent {
  const value = text.trim();
  if (!value) throw new PolarisError("VALIDATION_ERROR", "La intención de dispositivo está vacía.", 400);

  const family = familyPatterns.find(([, pattern]) => pattern.test(value))?.[0];
  if (!family) throw new PolarisError("NOT_FOUND", "No pude identificar la familia del dispositivo.", 404);

  if (/enciende|encender|prende|prender|activa|activar/i.test(value)) return { family, action: "ON", confidence: .94, needsDeviceResolution: true };
  if (/apaga|apagar|desactiva|desactivar/i.test(value)) return { family, action: "OFF", confidence: .94, needsDeviceResolution: true };
  if (/cambia|pon|establece|ajusta|ajustar/i.test(value) && /brillo|luminosidad/i.test(value)) {
    const match = value.match(/(\d{1,3})\s*%?/);
    return { family, action: "SET_BRIGHTNESS", value: Math.min(100, Math.max(0, Number(match?.[1] ?? 50))), confidence: .91, needsDeviceResolution: true };
  }
  if (/sube|aumenta|más volumen|mas volumen/i.test(value) && /volumen/i.test(value)) return { family, action: "SET_VOLUME", value: 70, confidence: .82, needsDeviceResolution: true };
  if (/baja|disminuye|menos volumen/i.test(value) && /volumen/i.test(value)) return { family, action: "SET_VOLUME", value: 30, confidence: .82, needsDeviceResolution: true };
  if (/silencia|silenciar|mute/i.test(value)) return { family, action: "MUTE", confidence: .95, needsDeviceResolution: true };
  if (/reanuda|reproduc|play/i.test(value)) return { family, action: "PLAY", confidence: .92, needsDeviceResolution: true };
  if (/pausa|pausar/i.test(value)) return { family, action: "PAUSE", confidence: .95, needsDeviceResolution: true };
  if (/siguiente|siguiente canal|next/i.test(value)) return { family, action: "NEXT", confidence: .9, needsDeviceResolution: true };
  if (/anterior|previous/i.test(value)) return { family, action: "PREVIOUS", confidence: .9, needsDeviceResolution: true };
  if (/reinicia|reiniciar|reinicio/i.test(value)) return { family, action: "REBOOT", confidence: .9, needsDeviceResolution: true };

  throw new PolarisError("NOT_FOUND", "Reconocí el dispositivo, pero no una acción segura para él.", 404);
}
