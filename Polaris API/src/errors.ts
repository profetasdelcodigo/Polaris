import type { ApiProblem } from "@polaris/contracts";

export class PolarisError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiProblem["code"];
  public readonly expose: boolean;

  public constructor(
    code: ApiProblem["code"],
    message: string,
    statusCode: number,
    options: { expose?: boolean; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "PolarisError";
    this.code = code;
    this.statusCode = statusCode;
    this.expose = options.expose ?? true;
  }
}

export function asPolarisError(error: unknown): PolarisError {
  if (error instanceof PolarisError) return error;
  return new PolarisError(
    "INTERNAL_ERROR",
    "Polaris no pudo completar la operación.",
    500,
    { expose: false, cause: error }
  );
}
