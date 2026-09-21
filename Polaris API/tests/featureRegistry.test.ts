import { describe, expect, it } from "vitest";
import { featureRegistrySummary, polarisFeatureRegistry } from "../src/core/features/featureRegistry.js";

describe("feature registry", () => {
  it("contains the expanded adaptive feature foundation", () => {
    const summary = featureRegistrySummary();
    expect(summary.count).toBeGreaterThanOrEqual(50);
    expect(summary.available).toBeGreaterThan(0);
    expect(polarisFeatureRegistry.some((feature) => feature.id === "consent-policy")).toBe(true);
    expect(polarisFeatureRegistry.some((feature) => feature.id === "browser-context")).toBe(true);
  });
});
