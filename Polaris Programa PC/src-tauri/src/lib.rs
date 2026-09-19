use keyring::Entry;
use serde::Serialize;

const SERVICE_NAME: &str = "com.profetasdelcodigo.polaris";
const SESSION_ACCOUNT: &str = "supabase-session";
const MAX_SESSION_BYTES: usize = 16 * 1024;

fn credential_entry() -> Result<Entry, String> {
    Entry::new(SERVICE_NAME, SESSION_ACCOUNT)
        .map_err(|error| format!("No se pudo abrir el almacén seguro del sistema: {error}"))
}

#[tauri::command]
fn store_session(serialized_session: String) -> Result<(), String> {
    if serialized_session.is_empty() || serialized_session.len() > MAX_SESSION_BYTES {
        return Err("La sesión tiene un tamaño inválido.".to_owned());
    }

    credential_entry()?
        .set_password(&serialized_session)
        .map_err(|error| format!("No se pudo guardar la sesión en el almacén seguro: {error}"))
}

#[tauri::command]
fn load_session() -> Result<Option<String>, String> {
    match credential_entry()?.get_password() {
        Ok(session) => Ok(Some(session)),
        // Keyring's exact no-entry wording varies by Windows credential backend.
        Err(error) if error.to_string().to_lowercase().contains("entry") => Ok(None),
        Err(error) => Err(format!(
            "No se pudo leer la sesión desde el almacén seguro: {error}"
        )),
    }
}

#[tauri::command]
fn clear_session() -> Result<(), String> {
    match credential_entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(error) if error.to_string().to_lowercase().contains("entry") => Ok(()),
        Err(error) => Err(format!(
            "No se pudo eliminar la sesión del almacén seguro: {error}"
        )),
    }
}

#[derive(Serialize)]
struct DesktopInfo {
    version: String,
    secure_session_storage: bool,
}

#[tauri::command]
fn desktop_info() -> DesktopInfo {
    DesktopInfo {
        version: env!("CARGO_PKG_VERSION").to_owned(),
        secure_session_storage: true,
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store_session,
            load_session,
            clear_session,
            desktop_info
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Polaris Desktop");
}
