import { describe, expect, it } from "vitest";
import { planUniversalTask, universalCatalogStats } from "./universalTaskRouter.js";

describe("universal task router", () => {
  it("plans observe/locate/act/verify/recover for an Android screenshot task", () => {
    const plan = planUniversalTask({
      task: "haz una captura de pantalla",
      preferredDevice: "ANDROID",
      requireVerification: true
    });

    expect(plan.observeBeforeAct).toBe(true);
    expect(plan.verifyAfterAct).toBe(true);
    expect(plan.steps.map((step) => step.stage)).toEqual(
      expect.arrayContaining(["OBSERVE", "LOCATE", "ACT", "VERIFY"])
    );
    expect(plan.steps.some((step) => step.stage === "RECOVER")).toBe(true);
    expect(plan.steps.every((step) => step.backend === "ANDROID" || step.stage === "RECOVER")).toBe(true);
  });

  it("can route desktop work to the desktop backend first", () => {
    const plan = planUniversalTask({
      task: "organiza mis archivos de Descargas",
      preferredDevice: "DESKTOP",
      allowRemote: true
    });

    expect(plan.strategy).toBe("LOCAL_FIRST");
    expect(plan.steps.some((step) => step.capabilityId === "desktop.files")).toBe(true);
    expect(plan.steps.some((step) => step.stage === "VERIFY")).toBe(true);
  });

  it("never claims that an unknown request is executed", () => {
    const plan = planUniversalTask({ task: "haz algo imposible que no existe" });

    expect(plan.status).toMatch(/READY|NEEDS_CONFIRMATION|NEEDS_PERMISSION/);
    expect(plan.steps.some((step) => step.capabilityId === "core.chat")).toBe(true);
  });

  it("keeps a large declarative catalog available without calling it implemented", () => {
    const stats = universalCatalogStats();

    expect(stats.intentFamilyCount).toBeGreaterThan(5);
    expect(stats.capabilityCount).toBeGreaterThan(5);
  });
});
