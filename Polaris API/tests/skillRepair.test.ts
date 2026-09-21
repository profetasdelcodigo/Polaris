import { describe, expect, it } from "vitest";
import { repairSkillFailure } from "../src/core/recovery/skillRepair.js";

describe("skill recovery", () => {
  it("adds a bounded wait for transient failures", () => {
    const result = repairSkillFailure(
      { version: 1, name: "demo", steps: [{ action: "open_url", url: "https://example.com" }] },
      0,
      "page is loading"
    );
    expect(result.strategy).toBe("WAIT_AND_RETRY");
    expect(result.repairedProgram?.steps[0]).toEqual({ action: "wait", ms: 750 });
  });

  it("does not invent arbitrary code for unsupported actions", () => {
    const result = repairSkillFailure(
      { version: 1, name: "demo", steps: [{ action: "focus_chat" }] },
      0,
      "unsupported on android"
    );
    expect(result.strategy).toBe("FOCUS_AND_RETRY");
  });
});
