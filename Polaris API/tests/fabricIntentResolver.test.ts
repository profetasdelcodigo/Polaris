import { describe, expect, it } from "vitest";
import { resolveFabricIntent } from "../src/core/fabric/fabricIntentResolver.js";

describe("fabric intent resolver", () => {
  it("maps Spanish open requests to real service functions", () => {
    const match = resolveFabricIntent("abre YouTube", "WEB");
    expect(match?.function.id).toBe("web.open.service.02-youtube");
    expect(match?.confidence).toBeGreaterThan(0.9);
  });

  it("maps service searches to a real relay function and preserves the query", () => {
    const match = resolveFabricIntent("busca en google polaris assistant", "DESKTOP");
    expect(match?.function.id).toBe("desktop.search.service.01-google");
    expect(match?.input).toBe("polaris assistant");
  });

  it("maps bounded waits to a concrete function", () => {
    const match = resolveFabricIntent("espera 1 segundo", "WEB");
    expect(match?.function.id).toBe("web.wait.04");
  });

  it("does not invent unsupported destinations", () => {
    expect(resolveFabricIntent("abre una app que no existe", "ANDROID")).toBeNull();
  });
});
