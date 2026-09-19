import { describe, expect, it } from "vitest";
import { ApiError } from "./api";

describe("ApiError", () => {
  it("retains a typed failure without exposing implementation detail", () => {
    const error = new ApiError("Proveedor no disponible.", "PROVIDER_ERROR", 503);
    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.status).toBe(503);
    expect(error.message).toBe("Proveedor no disponible.");
  });
});
