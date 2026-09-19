import { describe, expect, it } from "vitest";
import { calculateExpression } from "../src/core/tools/calculator.js";
import { PolarisError } from "../src/errors.js";

describe("calculateExpression", () => {
  it("calculates valid arithmetic without evaluating code", () => {
    expect(calculateExpression("2 * (3 + 4) - 5 / 5")).toBe(13);
  });

  it("rejects arbitrary code", () => {
    expect(() => calculateExpression("process.exit()")).toThrow(PolarisError);
  });

  it("rejects division by zero", () => {
    expect(() => calculateExpression("4 / 0")).toThrow("No se puede dividir entre cero");
  });
});
