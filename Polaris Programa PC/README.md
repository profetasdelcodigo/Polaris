# Polaris Programa PC

Cliente de escritorio independiente construido con Tauri 2, React y Rust.

## Seguridad

- No incorpora plugins de archivos, shell, procesos, automatización ni ejecución arbitraria.
- Las sesiones de Supabase se guardan mediante el administrador de credenciales del sistema operativo, no en texto plano.
- La capability de Tauri concede únicamente acciones básicas de ventana y los cuatro comandos internos de sesión tipados.
- Las claves privadas siguen perteneciendo al API; el cliente utiliza solamente valores públicos de Supabase.

## Desarrollo

1. Copia `.env.example` a `.env` y completa únicamente las claves públicas.
2. Desde la raíz ejecuta `pnpm install`.
3. Ejecuta `pnpm --dir "Polaris Programa PC" tauri:dev`.

Ejecuta `pnpm --dir "Polaris Programa PC" icon` para generar los iconos de paquete desde el símbolo vectorial antes de distribuir instaladores.
