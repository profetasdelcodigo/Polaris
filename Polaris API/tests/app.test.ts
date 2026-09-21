import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

const instances: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(instances.splice(0).map((instance) => instance.close()));
});

describe("Polaris API public contract", () => {
  it("reports honest capability state without environment credentials", async () => {
    const app = await buildApp({
      config: {
        nodeEnv: "test",
        port: 8787,
        host: "127.0.0.1",
        corsOrigins: ["http://localhost:5173"],
        aiProvider: "openai",
        aiModel: "gpt-5.5",
        supabaseUrl: undefined,
        supabasePublishableKey: undefined,
        supabaseServiceRoleKey: undefined,
        openAiApiKey: undefined,
        requestRateLimitMax: 30
      }
    });
    instances.push(app);

    const [health, capabilities] = await Promise.all([
      app.inject({ method: "GET", url: "/v1/health" }),
      app.inject({ method: "GET", url: "/v1/capabilities" })
    ]);

    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ backend: "ok", database: "unconfigured", provider: "unconfigured" });
    expect(capabilities.json()).toMatchObject({ chat: false, streaming: false, memory: false, voice: true });
  });

  it("rejects protected resources without a bearer token", async () => {
    const app = await buildApp({
      config: {
        nodeEnv: "test",
        port: 8787,
        host: "127.0.0.1",
        corsOrigins: ["http://localhost:5173"],
        aiProvider: "openai",
        aiModel: "gpt-5.5",
        supabaseUrl: undefined,
        supabasePublishableKey: undefined,
        supabaseServiceRoleKey: undefined,
        openAiApiKey: undefined,
        requestRateLimitMax: 30
      }
    });
    instances.push(app);

    const response = await app.inject({ method: "GET", url: "/v1/memories" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "DATABASE_ERROR" } });
  });
});
