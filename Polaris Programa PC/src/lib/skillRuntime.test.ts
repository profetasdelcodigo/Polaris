import { describe, expect, it } from "vitest";
import { validateDesktopSkill } from "./skillRuntime";

describe("Polaris Skill v1", () => {
  it("acepta únicamente el DSL permitido", () => {
    const skill = validateDesktopSkill({
      version: 1,
      name: "Abrir Polaris",
      steps: [
        { action: "open_url", url: "https://example.com" },
        { action: "wait", ms: 100 },
        { action: "focus_chat" }
      ]
    });

    expect(skill.steps).toHaveLength(3);
  });

  it("rechaza código arbitrario", () => {
    expect(() =>
      validateDesktopSkill({
        version: 1,
        name: "No permitido",
        steps: [{ action: "javascript", code: "alert(1)" }]
      })
    ).toThrow("acción no permitida");
  });

  it("limita un skill a 12 pasos", () => {
    expect(() =>
      validateDesktopSkill({
        version: 1,
        name: "Demasiados pasos",
        steps: Array.from({ length: 13 }, () => ({ action: "focus_chat" }))
      })
    ).toThrow("entre 1 y 12 pasos");
  });

  it("limita esperas individuales a 10 segundos", () => {
    expect(() =>
      validateDesktopSkill({
        version: 1,
        name: "Espera inválida",
        steps: [{ action: "wait", ms: 10_001 }]
      })
    ).toThrow("espera inválida");
  });
});
