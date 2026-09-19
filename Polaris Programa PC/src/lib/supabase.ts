import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

const fallbackUrl = "https://invalid.polaris.local";
const fallbackKey = "sb_publishable_configuration_required";

export const supabase = createClient(
  config.supabaseUrl || fallbackUrl,
  config.supabasePublishableKey || fallbackKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);
