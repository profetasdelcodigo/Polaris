import { describe, expect, it } from "vitest";
import { evaluateConsent } from "../src/core/security/consentPolicy.js";
import { createTaskState, checkpointTask, cancelTask } from "../src/core/tasks/taskState.js";
import { assessDeviceHealth } from "../src/core/devices/deviceHealth.js";
import { rankMemories } from "../src/core/memory/memoryScorer.js";
import { evaluateAutomationPolicy } from "../src/core/automation/automationPolicy.js";
import { createBrowserContext, browserContextSummary } from "../src/core/browser/browserContext.js";

describe("adaptive core", () => {
  it("blocks critical automation without explicit approval", () => {
    expect(evaluateConsent({ risk: "CRITICAL" }).decision).toBe("DENY");
    expect(evaluateConsent({ risk: "CRITICAL", explicitUserApproval: true }).decision).toBe("CONFIRM");
  });

  it("creates checkpoints and can cancel a task", () => {
    const task = checkpointTask(createTaskState("investigar"), "fuente-1", { source: "official" });
    expect(task.checkpoints).toHaveLength(1);
    expect(cancelTask(task).status).toBe("CANCELLED");
  });

  it("scores an online fresh device higher", () => {
    const health = assessDeviceHealth({
      deviceId: "device",
      type: "DESKTOP",
      status: "ONLINE",
      lastSeen: new Date().toISOString(),
      latencyMs: 100
    });
    expect(health.score).toBeGreaterThanOrEqual(90);
  });

  it("ranks relevant memories before unrelated ones", () => {
    const ranked = rankMemories("Polaris PC", [
      { content: "comida favorita", importance: 5 },
      { content: "Polaris se ejecuta en mi PC", importance: 3 }
    ]);
    expect(ranked[0].content).toContain("Polaris");
  });

  it("requires confirmation for medium risk automation without approval", () => {
    const policy = evaluateAutomationPolicy({
      risk: "MEDIUM",
      reversible: true,
      userRequested: true,
      hasPermission: true
    });
    expect(policy.requiresConfirmation).toBe(true);
  });

  it("normalizes browser context", () => {
    const context = createBrowserContext({ url: "https://example.com", visibleText: "hola" });
    expect(context.capturedAt).toBeTruthy();
    expect(browserContextSummary(context)).toContain("https://example.com");
  });
});
