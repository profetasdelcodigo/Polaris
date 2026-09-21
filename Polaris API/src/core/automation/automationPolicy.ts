import { evaluateConsent, type ConsentRisk } from "../security/consentPolicy.js";

export interface AutomationPolicyInput {
  risk: ConsentRisk;
  reversible: boolean;
  userRequested: boolean;
  hasPermission: boolean;
  dryRun?: boolean;
}

export interface AutomationPolicyResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

export function evaluateAutomationPolicy(input: AutomationPolicyInput): AutomationPolicyResult {
  if (input.dryRun) return { allowed: true, requiresConfirmation: false, reason: "Dry-run: no action is executed." };
  if (!input.userRequested) return { allowed: false, requiresConfirmation: false, reason: "La automatización no tiene una intención iniciada por el usuario." };
  if (!input.hasPermission) return { allowed: false, requiresConfirmation: false, reason: "Falta un permiso de plataforma." };
  const consent = evaluateConsent({ risk: input.risk });
  if (consent.decision === "DENY") return { allowed: false, requiresConfirmation: false, reason: consent.reason };
  if (consent.decision === "CONFIRM") return { allowed: false, requiresConfirmation: true, reason: consent.reason };
  if (!input.reversible && input.risk !== "LOW") return { allowed: false, requiresConfirmation: true, reason: "La acción no es reversible; requiere confirmación explícita." };
  return { allowed: true, requiresConfirmation: false, reason: consent.reason };
}
