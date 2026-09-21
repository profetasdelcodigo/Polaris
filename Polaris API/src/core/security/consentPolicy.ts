export type ConsentRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ConsentDecision = "ALLOW" | "CONFIRM" | "DENY";

export interface ConsentPolicyInput {
  risk: ConsentRisk;
  explicitUserApproval?: boolean;
  sessionApproved?: boolean;
  capabilityTrusted?: boolean;
}

export interface ConsentDecisionResult {
  decision: ConsentDecision;
  reason: string;
  expiresAfterExecution: boolean;
}

export function evaluateConsent(input: ConsentPolicyInput): ConsentDecisionResult {
  if (input.risk === "CRITICAL") {
    return input.explicitUserApproval
      ? { decision: "CONFIRM", reason: "Una acción crítica requiere aprobación explícita inmediata.", expiresAfterExecution: true }
      : { decision: "DENY", reason: "Las acciones críticas no se ejecutan automáticamente.", expiresAfterExecution: true };
  }
  if (input.risk === "HIGH") {
    return input.explicitUserApproval || input.sessionApproved
      ? { decision: "ALLOW", reason: "Existe aprobación explícita para esta operación de alto impacto.", expiresAfterExecution: true }
      : { decision: "CONFIRM", reason: "Se necesita confirmación antes de una operación de alto impacto.", expiresAfterExecution: true };
  }
  if (input.risk === "MEDIUM") {
    return input.sessionApproved || input.explicitUserApproval
      ? { decision: "ALLOW", reason: "La sesión cuenta con consentimiento para acciones de impacto medio.", expiresAfterExecution: false }
      : { decision: "CONFIRM", reason: "Polaris debe confirmar antes de continuar.", expiresAfterExecution: false };
  }
  return { decision: "ALLOW", reason: "La acción es de bajo riesgo y está permitida.", expiresAfterExecution: false };
}
