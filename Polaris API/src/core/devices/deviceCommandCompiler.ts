import crypto from "node:crypto";
import { PolarisError } from "../../errors.js";
import { validateDeviceCommand, type DeviceAction, type SmartDevice } from "./deviceFabric.js";

export type DeviceCommandEnvelope = {
  version: 1;
  id: string;
  targetDeviceId: string;
  family: SmartDevice["family"];
  protocol: SmartDevice["protocol"];
  action: DeviceAction;
  value?: string | number | boolean;
  requiresVerification: true;
};

export function compileDeviceCommand(input: {
  device: SmartDevice;
  action: DeviceAction;
  value?: string | number | boolean;
  confirmed?: boolean;
}): DeviceCommandEnvelope {
  const result = validateDeviceCommand(input);
  if (!result.allowed) throw new PolarisError("PERMISSION_DENIED", "Comando rechazado.", 403);
  return {
    version: 1,
    id: crypto.randomUUID(),
    targetDeviceId: input.device.id,
    family: input.device.family,
    protocol: input.device.protocol,
    action: input.action,
    ...(input.value !== undefined ? { value: input.value } : {}),
    requiresVerification: true
  };
}
