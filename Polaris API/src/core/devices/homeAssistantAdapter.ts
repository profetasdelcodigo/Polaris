import { PolarisError } from "../../errors.js";

const ALLOWED_SERVICES: Record<string, readonly string[]> = {
  light: ["turn_on", "turn_off", "toggle"],
  switch: ["turn_on", "turn_off", "toggle"],
  media_player: ["media_play", "media_pause", "media_stop", "volume_set", "volume_mute"],
  scene: ["turn_on"],
  script: ["turn_on"],
  climate: ["set_temperature", "set_hvac_mode"],
  cover: ["open_cover", "close_cover", "stop_cover"],
  fan: ["turn_on", "turn_off", "toggle", "set_percentage"],
  lock: ["lock", "unlock"]
};

const CONFIRMATION_REQUIRED = new Set([
  "lock.lock",
  "lock.unlock",
  "climate.set_temperature",
  "climate.set_hvac_mode",
  "script.turn_on"
]);

function configured() {
  const baseUrl = process.env.POLARIS_HOME_ASSISTANT_URL?.trim().replace(/\/$/, "");
  const token = process.env.POLARIS_HOME_ASSISTANT_TOKEN?.trim();
  return Boolean(baseUrl && token);
}

function configOrThrow() {
  const baseUrl = process.env.POLARIS_HOME_ASSISTANT_URL?.trim().replace(/\/$/, "");
  const token = process.env.POLARIS_HOME_ASSISTANT_TOKEN?.trim();
  if (!baseUrl || !token) {
    throw new PolarisError(
      "INTEGRATION_UNAVAILABLE",
      "Home Assistant no está configurado. Define POLARIS_HOME_ASSISTANT_URL y POLARIS_HOME_ASSISTANT_TOKEN.",
      503
    );
  }
  return { baseUrl, token };
}

export function homeAssistantStatus() {
  return {
    configured: configured(),
    baseUrlConfigured: Boolean(process.env.POLARIS_HOME_ASSISTANT_URL?.trim()),
    tokenConfigured: Boolean(process.env.POLARIS_HOME_ASSISTANT_TOKEN?.trim()),
    supportedDomains: Object.keys(ALLOWED_SERVICES)
  };
}

export function homeAssistantNeedsConfirmation(domain: string, service: string): boolean {
  return CONFIRMATION_REQUIRED.has(`${domain}.${service}`);
}

export async function executeHomeAssistant(input: {
  domain: string;
  service: string;
  entityId: string | string[];
  data?: Record<string, unknown>;
  confirmed?: boolean;
}) {
  const services = ALLOWED_SERVICES[input.domain];
  if (!services?.includes(input.service)) {
    throw new PolarisError(
      "NOT_FOUND",
      `Home Assistant no permite esta pareja dominio/servicio desde Polaris: ${input.domain}.${input.service}.`,
      404
    );
  }

  if (!input.entityId || (Array.isArray(input.entityId) && input.entityId.length === 0)) {
    throw new PolarisError("VALIDATION_ERROR", "entityId es obligatorio.", 400);
  }

  const operation = `${input.domain}.${input.service}`;
  if (homeAssistantNeedsConfirmation(input.domain, input.service) && input.confirmed !== true) {
    throw new PolarisError(
      "CONFIRMATION_REQUIRED",
      `La acción ${operation} requiere confirmación explícita.`,
      409
    );
  }

  const { baseUrl, token } = configOrThrow();
  const entityIds = Array.isArray(input.entityId) ? input.entityId : [input.entityId];
  for (const entityId of entityIds) {
    if (!/^[a-z0-9_]+\.[a-z0-9_]+$/i.test(entityId)) {
      throw new PolarisError("VALIDATION_ERROR", "entityId contiene un identificador inválido.", 400);
    }
  }

  const response = await fetch(
    `${baseUrl}/api/services/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.service)}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify({
        entity_id: entityIds,
        ...(input.data ?? {})
      })
    }
  );

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PolarisError(
      "INTEGRATION_ERROR",
      `Home Assistant respondió con HTTP ${response.status}.`,
      502,
      { expose: true, cause: body ?? undefined }
    );
  }

  return {
    ok: true,
    integration: "home_assistant",
    operation,
    entityIds,
    response: body
  };
}

export async function listHomeAssistantStates() {
  const { baseUrl, token } = configOrThrow();
  const response = await fetch(`${baseUrl}/api/states`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PolarisError("INTEGRATION_ERROR", `Home Assistant respondió con HTTP ${response.status}.`, 502);
  }
  return Array.isArray(body) ? body : [];
}
