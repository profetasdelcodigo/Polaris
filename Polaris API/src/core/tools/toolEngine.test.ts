import { describe, expect, it } from "vitest";
import { ToolEngine } from "./toolEngine.js";

describe("safe cross-device handoff", () => {
  it("is exposed to the model but remains restricted to safe actions", () => {
    const engine = new ToolEngine();
    const names = engine.list().map((tool) => tool.name);
    expect(names).toContain("handoff_safe_command");

    const definition = engine.aiDefinitions().find((tool) => tool.name === "handoff_safe_command");
    expect(definition).toBeDefined();

    const schema = definition?.parameters as { properties?: Record<string, unknown>; };
    const actions = schema.properties?.action as { enum?: string[] } | undefined;
    expect(actions?.enum).toContain("web.open_url");
    expect(actions?.enum).toContain("desktop.open_url");
    expect(actions?.enum).toContain("android.open_settings");
    expect(actions?.enum).not.toContain("desktop.shell");
    expect(actions?.enum).not.toContain("desktop.reveal_path");
  });
});
