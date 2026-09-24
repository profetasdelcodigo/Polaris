const DEFAULT_API_URL = "https://polaris-api-959h.onrender.com";
const DEFAULT_SUPABASE_URL = "https://wkaynoafhjtqkhuvknzf.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_-g_KBSi4qj8ZbY2CRrsuvg_TwNmamDV";

export const config = {
  // Production defaults make packaged desktop builds usable without a local API.
  // Vite env vars still override these values for development/test environments.
  apiUrl: (import.meta.env.VITE_POLARIS_API_URL ?? DEFAULT_API_URL).replace(/\/$/, ""),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? DEFAULT_SUPABASE_PUBLISHABLE_KEY
};

export const configurationIssues = [
  !config.supabaseUrl && "Falta VITE_SUPABASE_URL.",
  !config.supabasePublishableKey && "Falta VITE_SUPABASE_PUBLISHABLE_KEY."
].filter(Boolean) as string[];
