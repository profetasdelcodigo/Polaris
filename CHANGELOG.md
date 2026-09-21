# Changelog

## 0.2.0 — Polaris Adaptive Skills

### Núcleo
- Polaris Skill v1 con validación server-side.
- Compositor seguro de intención → microprograma.
- Huella determinista de skills para identificar exactamente qué programa se ejecutó.
- Límites de seguridad centralizados: 12 pasos, esperas acotadas y tamaño máximo.
- Mantiene el ciclo universal OBSERVE → LOCATE → ACT → VERIFY → RECOVER.

### Android
- Companion con invocación mediante el asistente del sistema.
- Escucha de voz automática al abrir la superficie del asistente.
- Modo conversación continua.
- Automatización local con AccessibilityService, observación de pantalla y pulsación por texto.
- Navegación rápida de sistema, ajustes y desplazamiento.

### PC
- Companion nativo Tauri.
- Ejecución de Polaris Skills allowlisted.
- Sesión almacenada en el almacén seguro del sistema.
- Base preparada para ampliar control de ventanas, entrada y archivos sin habilitar shell arbitrario.

### Web
- Cliente responsive conectado al mismo Core, memoria y relay de dispositivos.
- Atajos de teclado y continuidad de conversaciones.

### Arquitectura
- Web, Android y PC comparten contratos y Core.
- Los dispositivos pueden delegar tareas al dispositivo que tenga la capacidad necesaria.
- La IA no recibe permiso implícito para ejecutar código arbitrario.

