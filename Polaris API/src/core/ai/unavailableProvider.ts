import { PolarisError } from "../../errors.js";
import type { AICompletionInput, AIProvider, AIStreamEvent } from "./types.js";

export class UnavailableProvider implements AIProvider {
  public readonly available = false;

  public constructor(
    public readonly name: string,
    public readonly model: string,
    private readonly reason: string
  ) {}

  public async *stream(_input: AICompletionInput): AsyncGenerator<AIStreamEvent> {
    throw new PolarisError("PROVIDER_ERROR", this.reason, 503);
  }
}
