import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { appConfig, ConfigurationError, isSupabaseConfigured } from './config';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new ConfigurationError(
      'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en la configuración pública.',
    );
  }

  if (!client) {
    client = createClient(appConfig.supabaseUrl, appConfig.supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
