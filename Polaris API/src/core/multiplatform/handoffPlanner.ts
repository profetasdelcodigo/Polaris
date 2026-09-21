import { PolarisError } from "../../errors.js";

export type HandoffDevice = {
  id: string;
  type: "WEB" | "ANDROID" | "DESKTOP";
  online: boolean;
  latencyClass: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  capabilities: string[];
};

export function chooseHandoffTarget(
  devices: readonly HandoffDevice[],
  requestedCapability: string,
  preferredType?: HandoffDevice["type"]
): HandoffDevice {
  const compatible = devices.filter(
    (device) => device.online && device.capabilities.includes(requestedCapability)
  );

  if (!compatible.length) {
    throw new PolarisError(
      "NOT_FOUND",
      `No hay un dispositivo online compatible con la capacidad "${requestedCapability}".`,
      404
    );
  }

  const score = (device: HandoffDevice): number => {
    let value = 0;
    if (preferredType === device.type) value += 100;
    if (device.latencyClass === "LOW") value += 30;
    if (device.latencyClass === "MEDIUM") value += 15;
    if (device.type === "DESKTOP" && requestedCapability.startsWith("desktop.")) value += 20;
    if (device.type === "ANDROID" && requestedCapability.startsWith("android.")) value += 20;
    return value;
  };

  return [...compatible].sort((a, b) => score(b) - score(a))[0]!;
}

export function handoffEnvelope(input: {
  task: string;
  sourceDeviceId?: string;
  targetDevice: HandoffDevice;
  continuityToken?: string;
}) {
  return {
    version: 1,
    kind: "POLARIS_HANDOFF",
    createdAt: new Date().toISOString(),
    task: input.task,
    ...(input.sourceDeviceId ? { sourceDeviceId: input.sourceDeviceId } : {}),
    targetDeviceId: input.targetDevice.id,
    targetType: input.targetDevice.type,
    ...(input.continuityToken ? { continuityToken: input.continuityToken } : {}),
    requiresVerification: true
  };
}
