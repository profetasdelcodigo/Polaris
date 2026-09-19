import type { PolarisConfig } from "../../config.js";
import type { AIProvider } from "./types.js";
import { OpenAIProvider } from "./openAiProvider.js";
import { UnavailableProvider } from "./unavailableProvider.js";

export function createAIProvider(config: PolarisConfig): AIProvider {
  if (config.aiProvider === "openai" && config.openAiApiKey) {
    return new OpenAIProvider(config.openAiApiKey, config.aiModel);
  }

  const reason = config.aiProvider === "openai"
    ? "El proveedor OpenAI no está configurado. Agrega OPENAI_API_KEY únicamente al entorno del servidor."
    : `El proveedor ${config.aiProvider} está preparado como interfaz, pero aún no tiene un adaptador configurado.`;

  return new UnavailableProvider(config.aiProvider, config.aiModel, reason);
}
