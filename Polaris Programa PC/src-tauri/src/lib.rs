use keyring::Entry;
use serde::Serialize;
use std::path::Path;
use std::process::Command;

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



#[derive(Serialize)]
struct DesktopSystemInfo {
    os: String,
    arch: String,
    family: String,
    hostname: Option<String>,
    current_dir: Option<String>,
}

#[tauri::command]
fn system_info() -> DesktopSystemInfo {
    DesktopSystemInfo {
        os: std::env::consts::OS.to_owned(),
        arch: std::env::consts::ARCH.to_owned(),
        family: std::env::consts::FAMILY.to_owned(),
        hostname: std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .ok(),
        current_dir: std::env::current_dir()
            .ok()
            .map(|path| path.to_string_lossy().into_owned()),
    }
}

fn validate_external_url(url: &str) -> Result<(), String> {
    let normalized = url.trim();
    let allowed = normalized.starts_with("https://") || normalized.starts_with("http://");
    if normalized.is_empty() || !allowed || normalized.contains('\n') || normalized.contains('\r') {
        return Err("Solo se permiten URLs HTTP/HTTPS válidas.".to_owned());
    }
    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|error| format!("No se pudo abrir la URL: {error}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("No se pudo abrir la URL: {error}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|error| format!("No se pudo abrir la URL: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    let target = Path::new(path.trim());
    if target.as_os_str().is_empty() {
        return Err("La ruta no puede estar vacía.".to_owned());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(target)
            .spawn()
            .map_err(|error| format!("No se pudo abrir el explorador: {error}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(target)
            .spawn()
            .map_err(|error| format!("No se pudo mostrar la ruta: {error}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let folder = if target.is_dir() {
            target.to_path_buf()
        } else {
            target.parent().unwrap_or(target).to_path_buf()
        };
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(|error| format!("No se pudo abrir el explorador: {error}"))?;
    }

    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store_session,
            load_session,
            clear_session,
            desktop_info,
            system_info,
            open_url,
            reveal_path
        ])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Polaris Desktop");
}
