import { describe, expect, it } from "vitest";
import { listSkillCatalog, skillCatalogCapacity } from "./skillCatalog.js";

describe("skill catalog scale", () => {
  it("contains more than 10,000 unique declarative skills", () => {
    const skills = listSkillCatalog();
    const ids = new Set(skills.map((skill) => skill.id));
    expect(skillCatalogCapacity).toBeGreaterThan(10_000);
    expect(ids.size).toBeGreaterThan(10_000);
  });

  it("contains at least 1,000 recipes for each main client", () => {
    const skills = listSkillCatalog();
    for (const device of ["WEB", "ANDROID", "DESKTOP"] as const) {
      const count = skills.filter((skill) => skill.supportedDevices.includes(device)).length;
      expect(count).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("does not confuse planned recipes with implemented tools", () => {
    const skills = listSkillCatalog();
    expect(skills.filter((skill) => skill.status === "PLANNED").length).toBeGreaterThan(
      skills.filter((skill) => skill.status === "AVAILABLE").length
    );
  });
});
