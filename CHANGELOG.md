# Changelog

## 0.8.0 — Polaris Living Core

### Intelligence
- Orquestación de personalidad con modos CALM, FOCUS, CREATIVE, RESEARCH, OPERATOR y COMPANION.
- Experience Brief para unir intención, personalidad, latencia, visuales y guardrails.
- Sugerencias proactivas reversibles sin ejecución automática.
- Ciclo de vida de memoria: nueva, reforzada, conflictiva, obsoleta y archivada.

### Automation
- Device Resolver para nombres, habitaciones, familias, disponibilidad y protocolos.
- Scene Engine para secuencias y grupos paralelos con evaluación de riesgo.
- Skill Studio seguro para diseñar y explicar microprogramas allowlisted.
- Nuevo motor visual de estados y núcleo orbital 3D para Web, PC y Android.

### Device Fabric
- Contratos normalizados para luces, TV, router, teléfono, PC, nevera, microondas, aire acondicionado, cámaras, robots y otros equipos.
- Protocolos modelados para Matter, Home Assistant, MQTT, Cast, Alexa bridge, IR, Bluetooth y companions nativos.
- Las integraciones físicas externas siguen marcadas como PARTIAL cuando dependen de un adaptador o gateway todavía no incluido.

### Clients
- Web: núcleo orbital 3D interactivo, APIs de experiencia, resolución, escenas y Skill Studio.
- PC: escena orbital alrededor de la mascota Polaris y APIs de experiencia.
- Android: núcleo orbital Compose, APIs de experiencia, resolución, escenas y Skill Studio.

### Quality
- CI utilizada para detectar y corregir varios bloqueos de tipado del Core.
- Guía integral en `docs/POLARIS_COMPLETE_GUIDE.md`.
- El registro de capacidades conserva la distinción AVAILABLE/PARTIAL/PLANNED para evitar funciones ficticias.

## 0.4.0 — Polaris Autonomous Core Foundation

### Intelligence and control
- Política de consentimiento independiente del modelo.
- Estado de tareas con progreso, checkpoints, pausa y cancelación.
- Ranking de memoria por relevancia, importancia y frescura.
- Bus de eventos tipado para desacoplar automatización y observabilidad.
- Router de notificaciones multicanal.
- Política de automatización basada en intención, permisos, reversibilidad y riesgo.
- Evaluación de salud de companions con estado, antigüedad de heartbeat, latencia y score.
- Contexto estructurado del navegador.

### API
- Endpoints para consentimiento, tareas, salud de dispositivos, ranking de memoria, notificaciones, política de automatización y contexto de navegador.
- Tests para el Adaptive Core y el registro ampliado de capacidades.

### Capabilities
- El registro pasa de la primera tanda de 25 funciones a una base de 50+ capacidades clasificadas como AVAILABLE, PARTIAL o PLANNED.
- No se marca como AVAILABLE una integración que todavía dependa de APIs nativas no implementadas.

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
