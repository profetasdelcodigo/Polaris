# Changelog

## 0.3.0 — Polaris Adaptive Core

### Core
- Contexto adaptativo: memoria, perfil, preferencias y modo de interacción.
- Personalidad adaptativa para estudio, programación, investigación, urgencias, manos libres y concentración.
- Agent Planner con estrategia, riesgo, verificación y recuperación.
- Capability negotiation y nuevas capacidades Core registradas.
- Execution traces con fingerprint, dispositivo y estados de pasos.
- Continuity Capsules para trasladar una tarea entre dispositivos.
- Deep Research Planner con subpreguntas, consultas, política de fuentes y contraste.
- Constructor y preview de rutinas.
- Catálogo de 25 funciones nuevas, con estado AVAILABLE/PARTIAL en vez de prometer capacidades inexistentes.

### Skills
- Composer ampliado para URL explícita, copiar texto, esperas controladas y Skills compuestos.
- Las Skills siguen siendo allowlisted, validadas y sin ejecución arbitraria de shell, JavaScript o código nativo generado por la IA.

### API
- Nuevas rutas para features, planificador, contexto adaptativo, candidatos de memoria, investigación, continuidad y rutinas.
- `/v1/skills/execute` devuelve y conserva una traza inicial de ejecución junto al relay.

### Conversación
- El contexto principal de conversación ya incorpora modo adaptativo, preferencias y perfil junto con memorias relevantes.

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
