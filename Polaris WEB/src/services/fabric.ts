import type { Session } from '@supabase/supabase-js';

import { polarisApi } from './polaris';

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
  count?: number;
  byPlatform?: Record<string, number>;
};

export type WebFunction = (input?: unknown, confirmed?: boolean) => Promise<Record<string, unknown>>;

export async function loadWebFunctions(session: Session): Promise<Record<string, WebFunction>> {
  const catalog = (await polarisApi.getFabricCatalog(session, { platform: 'WEB' })) as CatalogResponse;
  const definitions = catalog.functions ?? [];

  return Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      (input?: unknown, confirmed = false) =>
        polarisApi.executeFabricFunction(session, {
          id: definition.id,
          input,
          targetDeviceId: undefined,
          confirmed,
        }),
    ]),
  );
}

export async function executeWebFunction(
  session: Session,
  id: string,
  input?: unknown,
  confirmed = false,
): Promise<Record<string, unknown>> {
  return polarisApi.executeFabricFunction(session, {
    id,
    input,
    confirmed,
  });
}
