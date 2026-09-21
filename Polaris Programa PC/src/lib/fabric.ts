import { api } from './api';

export type FabricFunctionDefinition = {
  id: string;
  name: string;
  platform: 'CORE' | 'WEB' | 'DESKTOP' | 'ANDROID';
  domain: string;
  description: string;
  mode: 'CORE' | 'RELAY';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresConfirmation: boolean;
  input: 'none' | 'text' | 'number' | 'json';
};

type CatalogResponse = {
  functions?: FabricFunctionDefinition[];
};

export type DesktopFunction = (input?: unknown, confirmed?: boolean) => Promise<Record<string, unknown>>;

export async function loadDesktopFunctions(): Promise<Record<string, DesktopFunction>> {
  const catalog = (await api.getFabricCatalog({ platform: 'DESKTOP' })) as CatalogResponse;
  const definitions = catalog.functions ?? [];

  return Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      (input?: unknown, confirmed = false) =>
        api.executeFabricFunction({
          id: definition.id,
          input,
          confirmed,
        }),
    ]),
  );
}

export async function executeDesktopFunction(
  id: string,
  input?: unknown,
  confirmed = false,
): Promise<Record<string, unknown>> {
  return api.executeFabricFunction({ id, input, confirmed });
}
