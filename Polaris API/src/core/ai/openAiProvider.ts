import OpenAI from "openai";
import { PolarisError } from "../../errors.js";
import type { AICompletionInput, AIProvider, AIStreamEvent } from "./types.js";

type FunctionCall = {
  callId: string;
  name: string;
  arguments: string;
};

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
      const tools = input.tools?.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true
      }));

      const first = await this.client.responses.create({
        model: this.model,
        instructions: input.system,
        input: [
          {
            role: "user",
            content: input.context + "\n\nMENSAJE_ACTUAL:\n" + input.user
          }
        ],
        ...(tools?.length ? { tools } : {}),
        stream: true,
        store: false
      }, { signal: input.signal });

      let responseId: string | undefined;
      const calls = new Map<string, FunctionCall>();

      for await (const event of first) {
        if (event.type === "response.created") {
          responseId = event.response.id;
        }
        if (event.type === "response.output_text.delta") {
          yield { type: "text_delta", delta: event.delta };
        }
        if (event.type === "response.function_call_arguments.delta") {
          const callId = event.item_id;
          const current = calls.get(callId) ?? {
            callId,
            name: "",
            arguments: ""
          };
          current.arguments += event.delta;
          calls.set(callId, current);
        }
        if (event.type === "response.output_item.done" && event.item.type === "function_call") {
          const call = calls.get(event.item.id) ?? {
            callId: event.item.call_id,
            name: event.item.name,
            arguments: event.item.arguments
          };
          call.callId = event.item.call_id;
          call.name = event.item.name;
          call.arguments = event.item.arguments;
          calls.set(event.item.id, call);
        }
      }

      if (!calls.size || !input.executeTool || !responseId) {
        yield { type: "completed", ...(responseId ? { providerResponseId: responseId } : {}) };
        return;
      }

      const outputs: Array<{
        type: "function_call_output";
        call_id: string;
        output: string;
      }> = [];

      for (const call of calls.values()) {
        yield { type: "tool_started", name: call.name };
        let result: unknown;
        try {
          result = await input.executeTool(call.name, JSON.parse(call.arguments || "{}"));
        } catch (error) {
          result = {
            error: error instanceof Error ? error.message : "La herramienta no pudo ejecutarse."
          };
        }
        yield { type: "tool_completed", name: call.name, result };
        outputs.push({
          type: "function_call_output",
          call_id: call.callId,
          output: JSON.stringify(result)
        });
      }

      const followUp = await this.client.responses.create({
        model: this.model,
        instructions: input.system,
        previous_response_id: responseId,
        input: outputs,
        ...(tools?.length ? { tools } : {}),
        stream: true,
        store: false
      }, { signal: input.signal });

      for await (const event of followUp) {
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
