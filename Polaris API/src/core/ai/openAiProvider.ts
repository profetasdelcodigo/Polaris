import OpenAI from "openai";
import { PolarisError } from "../../errors.js";
import type { AICompletionInput, AIProvider, AIStreamEvent } from "./types.js";

export class OpenAIProvider implements AIProvider {
  public readonly available = true;
  private readonly client: OpenAI;

  public constructor(
    apiKey: string,
    public readonly model: string
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 1, timeout: 60_000 });
  }

  public async *stream(input: AICompletionInput): AsyncGenerator<AIStreamEvent> {
    try {
      const stream = await this.client.responses.create({
        model: this.model,
        instructions: input.system,
        input: [
          {
            role: "user",
            content: `${input.context}\n\nMENSAJE_ACTUAL:\n${input.user}`
          }
        ],
        stream: true,
        store: false
      }, { signal: input.signal });

      let responseId: string | undefined;
      for await (const event of stream) {
        if (event.type === "response.created") {
          responseId = event.response.id;
        }
        if (event.type === "response.output_text.delta") {
          yield { type: "text_delta", delta: event.delta };
        }
      }
      yield { type: "completed", ...(responseId ? { providerResponseId: responseId } : {}) };
    } catch (error) {
      if (input.signal.aborted) {
        throw new PolarisError("TIMEOUT", "La generación fue cancelada.", 499);
      }
      if (error instanceof PolarisError) throw error;
      throw new PolarisError(
        "PROVIDER_ERROR",
        "El proveedor de IA no está disponible en este momento.",
        502,
        { cause: error }
      );
    }
  }
}
