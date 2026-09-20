import { describe, expect, it } from "vitest";
import { buildContext } from "../src/core/context/contextEngine.js";
import { listMessages } from "../src/data/polarisRepository.js";

type FakeRow = Record<string, unknown>;

function queryFor(rows: FakeRow[]) {
  return {
    select: () => queryFor(rows),
    eq: () => queryFor(rows),
    order: () => queryFor(rows),
    limit: (count: number) => queryFor(rows.slice(0, count)),
    textSearch: () => queryFor(rows),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    abortSignal: () => queryFor(rows),
    then: (resolve: (value: { data: FakeRow[]; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null }))
  };
}

function fakeDb(messageRows: FakeRow[]) {
  return {
    from(table: string) {
      if (table === "conversations") return queryFor([{ id: "conversation" }]);
      if (table === "messages") return queryFor(messageRows);
      if (table === "memories") return queryFor([]);
      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

describe("repository/context correctness", () => {
  it("returns the newest messages while preserving chronological order", async () => {
    const newestFirst = Array.from({ length: 13 }, (_, index) => {
      const value = 13 - index;
      return {
        id: String(value),
        conversation_id: "conversation",
        role: value % 2 === 0 ? "assistant" : "user",
        content: `MESSAGE ${value}`,
        status: "completed",
        metadata: {},
        created_at: new Date(2026, 0, value).toISOString()
      };
    });

    const rows = await listMessages(
      { db: fakeDb(newestFirst), user: { id: "user" } } as never,
      "conversation",
      12
    );

    expect(rows).toHaveLength(12);
    expect(rows.map((row) => row.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 2))
    );
  });

  it("excludes the current user message from model context", async () => {
    const messageRows = Array.from({ length: 13 }, (_, index) => ({
      id: String(index + 1),
      conversation_id: "conversation",
      role: index % 2 === 0 ? "user" : "assistant",
      content: index === 12 ? "CURRENT MESSAGE" : `MESSAGE ${index + 1}`,
      status: "completed",
      metadata: {},
      created_at: new Date(2026, 0, index + 1).toISOString()
    })).reverse();

    const context = await buildContext(
      { db: fakeDb(messageRows), user: { id: "user" } } as never,
      "conversation",
      "CURRENT MESSAGE",
      "13"
    );

    expect(context).toContain("MESSAGE 1");
    expect(context).toContain("MESSAGE 12");
    expect(context).not.toContain("CURRENT MESSAGE");
  });
});
