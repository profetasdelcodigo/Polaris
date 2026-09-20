export type AIToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type AIStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "tool_started"; name: string }
  | { type: "tool_completed"; name: string; result: unknown }
  | { type: "completed"; providerResponseId?: string };

export interface AICompletionInput {
  system: string;
  user: string;
  context: string;
  signal: AbortSignal;
  tools?: readonly AIToolDefinition[];
  executeTool?: (name: string, input: unknown) => Promise<unknown>;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly available: boolean;
  stream(input: AICompletionInput): AsyncGenerator<AIStreamEvent>;
}
