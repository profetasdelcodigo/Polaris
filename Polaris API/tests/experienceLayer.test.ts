import { describe, expect, it } from "vitest";
import { buildPersonaProfile } from "../src/core/personality/personaEngine.js";
import { evaluateMemoryLifecycle } from "../src/core/memory/memoryLifecycle.js";
import { compileScene } from "../src/core/automation/sceneEngine.js";
import { buildVisualScene } from "../src/core/visuals/visualDirector.js";

describe("experience layer", () => {
  it("adapts persona to operator work without changing safety", () => {
    const profile = buildPersonaProfile({ task: "enciende la luz de la sala" });
    expect(profile.mode).toBe("OPERATOR");
    expect(profile.confirmationStyle).toBe("strict");
  });

  it("detects repeated memories deterministically", () => {
    const result = evaluateMemoryLifecycle(
      { content: "Prefiero respuestas breves.", category: "PREFERENCE" },
      [{ id: "m1", content: "Prefiero respuestas breves.", category: "PREFERENCE" }]
    );
    expect(result.state).toBe("REINFORCED");
    expect(result.duplicateOf).toBe("m1");
  });

  it("compiles scenes into ordered groups and requires confirmation for dangerous actions", () => {
    const result = compileScene({
      name: "Modo seguro",
      steps: [
        { deviceId: "light-1", action: "OFF" },
        { deviceId: "router-1", action: "REBOOT", afterMs: 500 }
      ]
    });
    expect(result.groups).toHaveLength(2);
    expect(result.requiresConfirmation).toBe(true);
  });

  it("keeps visual behavior deterministic", () => {
    const scene = buildVisualScene("FOCUS", "THINKING");
    expect(scene.depth).toBe("3d");
    expect(scene.accent).toBe("violet");
    expect(scene.labels).toContain("safe-runtime");
  });
});
