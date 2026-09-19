import { invoke } from "@tauri-apps/api/core";
import type { Session } from "@supabase/supabase-js";

type PersistedSession = Pick<Session, "access_token" | "refresh_token">;

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function saveSecureSession(session: Session): Promise<void> {
  if (!isTauriRuntime()) return;
  const payload: PersistedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token
  };
  await invoke("store_session", { serializedSession: JSON.stringify(payload) });
}

export async function loadSecureSession(): Promise<PersistedSession | null> {
  if (!isTauriRuntime()) return null;
  const raw = await invoke<string | null>("load_session");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed.access_token !== "string" || typeof parsed.refresh_token !== "string") {
      return null;
    }
    return { access_token: parsed.access_token, refresh_token: parsed.refresh_token };
  } catch {
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("clear_session");
}
