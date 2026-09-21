import { describe, expect, it } from "vitest";
import { discoverableProtocolMatrix, validateDeviceCommand } from "../src/core/devices/deviceFabric.js";

describe("device fabric", () => {
  const light = {
    id: "light-1",
    name: "Luz",
    family: "LIGHT" as const,
    protocol: "MATTER" as const,
    online: true,
    local: true,
    capabilities: ["GET_STATE", "ON", "OFF", "TOGGLE", "SET_BRIGHTNESS"] as const
  };

  it("allows safe light commands and validates ranges", () => {
    expect(validateDeviceCommand({ device: light, action: "ON" }).allowed).toBe(true);
    expect(() => validateDeviceCommand({ device: light, action: "SET_BRIGHTNESS", value: 120 })).toThrow();
  });

  it("requires explicit confirmation for dangerous device actions", () => {
    const pc = { ...light, family: "PC" as const, capabilities: ["REBOOT"] as const };
    expect(() => validateDeviceCommand({ device: pc, action: "REBOOT" })).toThrow();
    expect(validateDeviceCommand({ device: pc, action: "REBOOT", confirmed: true }).allowed).toBe(true);
  });

  it("exposes real protocol boundaries", () => {
    const matrix = discoverableProtocolMatrix();
    expect(matrix.some(item => item.protocol === "MATTER")).toBe(true);
    expect(matrix.some(item => item.protocol === "HOME_ASSISTANT")).toBe(true);
    expect(matrix.some(item => item.protocol === "ALEXA_BRIDGE")).toBe(true);
  });
});
