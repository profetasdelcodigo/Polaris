export const config = {
  apiUrl: (import.meta.env.VITE_POLARIS_API_URL ?? "http://localhost:8787").replace(/\/$/, ""),
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""
};

export const configurationIssues = [
  !config.supabaseUrl && "Falta VITE_SUPABASE_URL.",
  !config.supabasePublishableKey && "Falta VITE_SUPABASE_PUBLISHABLE_KEY."
].filter(Boolean) as string[];
