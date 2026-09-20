import OpenAI from "openai";
import { PolarisError } from "../../errors.js";
import type { AICompletionInput, AIProvider, AIStreamEvent } from "./types.js";

type FunctionCall = {
  callId: string;
  name: string;
  arguments: string;
};

const MAX_TOOL_ROUNDS = 4;

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

      let inputItems: Array<Record<string, unknown>> = [
        {
          role: "user",
          content: input.context + "\n\nMENSAJE_ACTUAL:\n" + input.user
        }
      ];

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const responseStream = await this.client.responses.create(
          {
            model: this.model,
            instructions: input.system,
            input: inputItems,
            ...(tools?.length ? { tools } : {}),
            stream: true,
            store: false
          },
          { signal: input.signal }
        );

        const callsByItemId = new Map<string, FunctionCall>();
        const outputItems: Array<Record<string, unknown>> = [];
        let responseId: string | undefined;

        for await (const event of responseStream) {
          if (event.type === "response.created") {
            responseId = event.response.id;
          }

          if (event.type === "response.output_text.delta") {
            yield { type: "text_delta", delta: event.delta };
          }

          if (event.type === "response.output_item.done") {
            outputItems.push(event.item as unknown as Record<string, unknown>);

            if (event.item.type === "function_call") {
              const call = {
                callId: event.item.call_id,
                name: event.item.name,
                arguments: event.item.arguments
              } satisfies FunctionCall;
              callsByItemId.set(event.item.id, call);
            }
          }
        }

        const calls = [...callsByItemId.values()];
        if (calls.length === 0) {
          yield { type: "completed", ...(responseId ? { providerResponseId: responseId } : {}) };
          return;
        }

        if (!input.executeTool) {
          throw new PolarisError(
            "PROVIDER_ERROR",
            "El modelo solicitó una herramienta, pero Polaris no tiene un ejecutor disponible.",
            502
          );
        }

        if (round === MAX_TOOL_ROUNDS) {
          throw new PolarisError(
            "TIMEOUT",
            "La tarea requirió demasiadas llamadas de herramienta seguidas.",
            508
          );
        }

        const toolOutputs: Array<Record<string, unknown>> = [];

        for (const call of calls) {
          yield { type: "tool_started", name: call.name };

          let result: unknown;
          try {
            const parsedArguments = JSON.parse(call.arguments || "{}");
            result = await input.executeTool(call.name, parsedArguments);
          } catch (error) {
            result = {
              error: error instanceof Error
                ? error.message
                : "La herramienta no pudo ejecutarse."
            };
          }

          yield { type: "tool_completed", name: call.name, result };

          toolOutputs.push({
            type: "function_call_output",
            call_id: call.callId,
            output: JSON.stringify(result)
          });
        }

        // Con store=false no podemos usar previous_response_id. Responses requiere
        // reenviar los output items del modelo junto con los resultados de las herramientas.
        inputItems = [...inputItems, ...outputItems, ...toolOutputs];
      }
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
