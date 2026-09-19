export type AIStreamEvent =
  | { type: "text_delta"; delta: string }
  | { type: "completed"; providerResponseId?: string };

export interface AICompletionInput {
  system: string;
  user: string;
  context: string;
  signal: AbortSignal;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  readonly available: boolean;
  stream(input: AICompletionInput): AsyncGenerator<AIStreamEvent>;
}
