import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@polaris/contracts";
import { hasSupabaseConfiguration, type PolarisConfig } from "./config.js";
import { PolarisError } from "./errors.js";

export type AuthenticatedContext = {
  user: User;
  accessToken: string;
  db: ReturnType<typeof createClient<Database>>;
};


function getBearerToken(header: string | undefined): string {
  if (!header?.startsWith("Bearer ")) {
    throw new PolarisError("AUTH_ERROR", "Se requiere una sesión válida.", 401);
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new PolarisError("AUTH_ERROR", "Se requiere una sesión válida.", 401);
  return token;
}

export async function authenticateRequest(
  authorization: string | undefined,
  config: PolarisConfig
): Promise<AuthenticatedContext> {
  if (!hasSupabaseConfiguration(config)) {
    throw new PolarisError(
      "DATABASE_ERROR",
      "Supabase no está configurado en el servidor.",
      503
    );
  }

  const accessToken = getBearerToken(authorization);
  const verifier = createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await verifier.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new PolarisError("AUTH_ERROR", "La sesión no es válida o expiró.", 401);
  }

  const db = createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

  return { user: data.user, accessToken, db };
}
