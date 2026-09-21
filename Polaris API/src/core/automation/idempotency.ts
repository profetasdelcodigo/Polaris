import crypto from "node:crypto";

export function idempotencyKey(parts: readonly string[]): string {
  return crypto.createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
}

export function isLikelyIdempotent(action: string): boolean {
  return ["open_url","scroll_top","scroll_bottom","system_info","wait","focus_chat"].includes(action);
}
