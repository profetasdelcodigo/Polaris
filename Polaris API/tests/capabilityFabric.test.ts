import { describe, expect, it } from "vitest";
import {
  buildFabricRelayPayload,
  executeCoreFabricFunction,
  fabricCatalog,
  fabricCatalogSummary,
  getFabricFunction
} from "../src/core/fabric/capabilityFabric.js";

describe("capability fabric", () => {
  it("exposes more than one thousand unique functions", () => {
    const ids = new Set(fabricCatalog.map((item) => item.id));
    const summary = fabricCatalogSummary();

    expect(summary.count).toBeGreaterThan(1000);
    expect(ids.size).toBe(summary.count);
    expect(summary.byPlatform.WEB).toBeGreaterThan(100);
    expect(summary.byPlatform.DESKTOP).toBeGreaterThan(100);
  });

  it("executes deterministic core math functions", () => {
    const fn = getFabricFunction("core.math.add.by-7");
    expect(fn).toBeDefined();
    expect(executeCoreFabricFunction(fn!, 10)).toBe(17);
  });

  it("executes deterministic text functions", () => {
    const fn = getFabricFunction("core.text.upper.1");
    expect(fn).toBeDefined();
    expect(executeCoreFabricFunction(fn!, "Polaris")).toBe("POLARIS");
  });

  it("compiles a real desktop relay payload", () => {
    const fn = fabricCatalog.find(
      (item) => item.id === "desktop.open.service.01-google"
    );
    expect(fn).toBeDefined();
    const payload = buildFabricRelayPayload(fn!, undefined);
    expect(payload.url).toBe("https://www.google.com/");
  });

  it("compiles a Web wait as a bounded Skill", () => {
    const fn = getFabricFunction("web.wait.04");
    expect(fn).toBeDefined();
    const payload = buildFabricRelayPayload(fn!, undefined);
    expect(payload).toEqual({
      program: {
        version: 1,
        steps: [{ action: "wait", ms: 1000 }]
      }
    });
  });
});
