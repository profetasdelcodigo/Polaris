export interface RecoveryPolicy {
  retryable: boolean;
  maxRetries: number;
  idempotent: boolean;
  fallbackCapabilities: readonly string[];
  alternateDevicesAllowed: boolean;
  stopReasons: readonly string[];
}

export function recoveryPolicy(input: {
  capability: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  idempotent?: boolean;
  fallbacks?: readonly string[];
}): RecoveryPolicy {
  const idempotent = input.idempotent ?? (
    input.capability.startsWith("web.") ||
    input.capability.includes("open") ||
    input.capability === "core.context"
  );

  return {
    retryable: input.risk !== "CRITICAL" && idempotent,
    maxRetries: input.risk === "LOW" ? 2 : input.risk === "MEDIUM" ? 1 : 0,
    idempotent,
    fallbackCapabilities: input.fallbacks ?? [],
    alternateDevicesAllowed: input.risk !== "CRITICAL",
    stopReasons: [
      "La verificación contradictoria indica que el objetivo no se cumplió.",
      "La siguiente ruta requiere un permiso que no fue concedido.",
      "La acción puede producir un cambio irreversible.",
      "No queda un dispositivo autenticado compatible.",
      "Se agotaron los reintentos seguros."
    ]
  };
}
