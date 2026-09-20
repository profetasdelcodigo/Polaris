import { describe, expect, it } from "vitest";
import { ConversationEngine } from "../src/core/conversation/conversationEngine.js";
import { ToolEngine } from "../src/core/tools/toolEngine.js";
import type { AIProvider } from "../src/core/ai/types.js";
import { PolarisError } from "../src/errors.js";

class FakeQuery {
  select() { return this; }
  eq() { return this; }
  order() { return this; }
  limit() { return this; }
  ilike() { return this; }
  then<TResult1 = { data: never[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: never[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled as never, onrejected as never);
  }
}

const context = {
  user: { id: "user-test" },
  db: { from: () => new FakeQuery() }
} as never;

describe("ToolEngine safety boundary", () => {
  it("does not allow the model to execute state-changing memory tools", async () => {
    const engine = new ToolEngine();

    await expect(
      engine.executeModelCallable(context, "save_memory", {
        content: "esto no debe guardarse"
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      statusCode: 403
    });
  });

  it("allows model-safe calculator execution", async () => {
    const engine = new ToolEngine();

    await expect(
      engine.executeModelCallable(context, "calculator", { expression: "2 + 3 * 4" })
    ).resolves.toEqual({
      expression: "2 + 3 * 4",
      result: 14
    });
  });
});

describe("ConversationEngine model tool boundary", () => {
  it("rejects a provider attempt to invoke a non-model tool", async () => {
    const provider: AIProvider = {
      name: "test",
      model: "test",
      available: true,
      async *stream(input) {
        expect(input.executeTool).toBeDefined();
        await expect(input.executeTool!("save_memory", { content: "no" }, new AbortController().signal)).rejects.toBeInstanceOf(PolarisError);
        yield { type: "text_delta", delta: "No ejecutado." };
        yield { type: "completed" };
      }
    };

    const engine = new ConversationEngine(provider, new ToolEngine());

    const events = [];
    for await (const event of engine.stream(context, {
      conversationId: "00000000-0000-4000-8000-000000000001",
      message: "haz algo",
      signal: new AbortController().signal
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "message.delta", delta: "No ejecutado." },
      { type: "message.done" }
    ]);
  });
});
