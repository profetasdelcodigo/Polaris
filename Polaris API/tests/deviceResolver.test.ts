import { describe, expect, it } from "vitest";
import { resolveDeviceReference } from "../src/core/devices/deviceResolver.js";

describe("device resolver", () => {
  const tv = {
    id: "tv-room",
    name: "TV Samsung",
    family: "TV" as const,
    protocol: "GOOGLE_CAST" as const,
    online: true,
    local: true,
    capabilities: ["GET_STATE", "PLAY", "PAUSE"] as const,
    metadata: { room: "sala" }
  };

  it("resolves by family and room", () => {
    const result = resolveDeviceReference("la tele de la sala", [tv]);
    expect(result.status).toBe("RESOLVED");
    if (result.status === "RESOLVED") expect(result.device.id).toBe("tv-room");
  });

  it("uses recent activity to break a close tie", () => {
    const recent = {
      ...tv,
      id: "tv-recent",
      name: "Tele principal",
      metadata: { room: "dormitorio", lastUsedAt: new Date().toISOString() }
    };
    const other = {
      ...tv,
      id: "tv-other",
      name: "Tele secundaria",
      metadata: { room: "dormitorio" }
    };

    const result = resolveDeviceReference("tele dormitorio", [other, recent]);
    expect(result.status).toBe("RESOLVED");
    if (result.status === "RESOLVED") expect(result.device.id).toBe("tv-recent");
  });

  it("does not resolve unrelated devices", () => {
    const result = resolveDeviceReference("la cámara del jardín", [tv]);
    expect(result.status).toBe("NOT_FOUND");
  });
});
