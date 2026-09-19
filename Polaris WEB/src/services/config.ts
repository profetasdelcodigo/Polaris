const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const publicValue = (value: string | undefined) => value?.trim() ?? '';

const suppliedApiUrl = publicValue(import.meta.env.VITE_POLARIS_API_URL);

export const appConfig = {
  apiBaseUrl: trimTrailingSlash(suppliedApiUrl),
  supabaseUrl: publicValue(import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: publicValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
};

export const isApiConfigured = appConfig.apiBaseUrl.length > 0;
export const isSupabaseConfigured =
  appConfig.supabaseUrl.length > 0 && appConfig.supabasePublishableKey.length > 0;

export function apiUrl(path: string): string {
  if (!isApiConfigured) {
    throw new ConfigurationError('Falta VITE_POLARIS_API_URL.');
  }

  const root = appConfig.apiBaseUrl.replace(/\/v1$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${root}/v1${normalizedPath}`;
}

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
