import { describe, expect, it } from "vitest";
import { compileScene } from "../src/core/automation/sceneEngine.js";

describe("scene engine", () => {
  it("creates a deterministic idempotency key and recovery metadata", () => {
    const input = {
      name: "Modo estudio",
      steps: [
        { deviceId: "light-desk", action: "ON" as const, rollback: { action: "OFF" as const } },
        { deviceId: "pc", action: "OPEN_APP" as const, value: "editor" }
      ]
    };
    const first = compileScene(input);
    const second = compileScene(input);
    expect(first.version).toBe(2);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(first.recovery.mode).toBe("ROLLBACK_WHERE_DEFINED");
    expect(first.recovery.rollbackSteps).toBe(1);
  });

  it("requires a real device id and caps delays", () => {
    expect(() => compileScene({
      name: "Invalid",
      steps: [{ deviceId: "", action: "ON" as const }]
    })).toThrow();

    const compiled = compileScene({
      name: "Delay",
      steps: [{ deviceId: "light", action: "ON" as const, afterMs: 999999 }]
    });
    expect(compiled.groups[0]?.delayMs).toBe(30_000);
  });

  it("requires confirmation for high-impact scenes", () => {
    const compiled = compileScene({
      name: "Reinicio",
      steps: [{ deviceId: "pc", action: "REBOOT" as const }]
    });
    expect(compiled.requiresConfirmation).toBe(true);
    expect(compiled.risk).toBe("HIGH");
  });
});
