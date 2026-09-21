const suspiciousPatterns = [
  /ignore\s+(all|previous|prior)\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /show\s+(me\s+)?secret/i,
  /bypass\s+(security|permission|confirmation)/i,
  /execute\s+arbitrary\s+(shell|javascript|code)/i
];

export interface PromptBoundaryResult {
  safe: boolean;
  flags: string[];
  sanitized: string;
}

export function inspectPromptBoundary(input: string): PromptBoundaryResult {
  const flags = suspiciousPatterns
    .filter((pattern) => pattern.test(input))
    .map((pattern) => pattern.source);
  return {
    safe: flags.length === 0,
    flags,
    sanitized: input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, 20_000)
  };
}
