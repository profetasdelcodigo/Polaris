import { describe, expect, it } from "vitest";
import { createOfflineQueueItem, nextQueueState } from "../src/core/automation/offlineQueue.js";
import { compileBoundedMacro } from "../src/core/skills/skillMacro.js";
import { chooseHandoffTarget } from "../src/core/multiplatform/handoffPlanner.js";

describe("Polaris autonomy fabric", () => {
  it("creates replay-safe offline work and stops after bounded retries", () => {
    const item = createOfflineQueueItem({ userId: "u1", task: "abre youtube", safeToReplay: true, maxAttempts: 2 });
    expect(item.state).toBe("PENDING");
    const retry = nextQueueState(item, "RETRY");
    expect(retry.attempts).toBe(1);
    const failed = nextQueueState(retry, "RETRY");
    expect(failed.state).toBe("FAILED");
  });

  it("compiles only bounded safe macros", () => {
    const program = compileBoundedMacro({
      name: "doble scroll",
      repeat: 2,
      steps: [{ action: "scroll_top" }, { action: "scroll_bottom" }]
    });
    expect(program.steps).toHaveLength(4);
  });

  it("selects an online capable handoff target", () => {
    const target = chooseHandoffTarget([
      { id: "a", type: "ANDROID", online: false, latencyClass: "LOW", capabilities: ["android.run_skill"] },
      { id: "b", type: "DESKTOP", online: true, latencyClass: "MEDIUM", capabilities: ["desktop.run_skill"] },
      { id: "c", type: "ANDROID", online: true, latencyClass: "LOW", capabilities: ["android.run_skill"] }
    ], "android.run_skill", "ANDROID");
    expect(target.id).toBe("c");
  });
});
