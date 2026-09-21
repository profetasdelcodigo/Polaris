# Polaris — Guía completa de funciones (Experience Core 0.9) — Guía completa de funciones

## Estado general

Polaris es un asistente multiplataforma con un Core API y tres clientes independientes: Web React/Vite, Android nativo Kotlin/Compose y Desktop nativo Tauri/React.
La ruta de ejecución está diseñada como intención → clasificación → contexto → política → Skill/comando seguro → cliente/relay → verificación → recovery.
El modelo no recibe permiso genérico para ejecutar shell, JavaScript arbitrario o código nativo.

## 1. Inteligencia y personalidad

Persona Engine: modos CALM, FOCUS, CREATIVE, RESEARCH, OPERATOR y COMPANION.
Cada modo modifica tono, verbosidad, iniciativa, estilo de confirmación y energía visual, sin modificar las reglas de seguridad.
Experience Brief combina intención, personalidad, dispositivo preferido, presupuesto de latencia, estado visual, promesas y guardrails.
Intent classifier: CHAT, ACTION, RESEARCH, MEMORY, DEVICE_CONTROL, NAVIGATION, AUTOMATION, SETTINGS, CANCEL y UNKNOWN.
Agent Planner construye una estrategia de ejecución con riesgo, verificación y recuperación.

## 2. Memoria

Memoria persistente: categorías, importancia, fuente, creación, actualización y borrado.
Memory ranking: relevancia + importancia + frescura.
Memory lifecycle: NEW, REINFORCED, CONFLICTING, STALE y ARCHIVED.
El lifecycle calcula fingerprint, confianza, razón y siguiente acción sugerida. Las coincidencias fuertes se detectan antes de volver a crear la misma memoria.

## 3. Skills

Polaris Skill v1 usa acciones allowlisted: open_url, reveal_path, system_info, copy_text, scroll_top, scroll_bottom, focus_chat y wait.
Límites actuales: máximo 12 pasos, wait máximo 10 s y programa máximo 32 KB.
Skill Composer convierte lenguaje natural en microprogramas seguros.
Skill Preview genera dry-run, fingerprint, trace y recovery previsto.
Skill Studio diseña y explica un programa y rechaza pedidos de shell, eval, JavaScript arbitrario o evasión de permisos.
Skill Repair sólo permite estrategias predefinidas: retry, wait_and_retry, focus_and_retry, remove_unsupported_step y no_safe_repair.

## 4. Automatización y autonomía

Task State: QUEUED, RUNNING, PAUSED, WAITING_USER, SUCCEEDED, FAILED y CANCELLED.
Incluye progreso, checkpoints, cancelación y tareas reanudables.
Offline Queue modela tareas seguras para replay con límites e idempotencia.
Automation Policy combina riesgo, reversibilidad, petición explícita, permisos y dry-run.
Emergency Stop: cancelación explícita.
Autonomy Fabric conecta planificación, consentimiento, Skill, verificación y recovery.

## 5. Escenas

Scene Engine compila hasta 24 pasos, crea grupos ordenados/paralelos, limita retrasos, calcula fingerprint e idempotencyKey deterministas, estima riesgo, exige confirmation para acciones de alto impacto y admite recovery mediante rollback por paso cuando el autor lo define. Si no existe rollback seguro, la estrategia es STOP_AND_REPORT.
Esto permite conceptos como modo cine, modo estudio o modo noche sin inventar que todos los dispositivos ya tengan un adaptador real.

## 6. Device Fabric

Familias modeladas: LIGHT, SWITCH, PLUG, TV, SPEAKER, ROUTER, PHONE, TABLET, PC, FRIDGE, MICROWAVE, AC, CAMERA, ROBOT y OTHER.
Protocolos modelados: MATTER, HOME_ASSISTANT, MQTT, HTTP_LOCAL, CHROMECAST, ANDROID_TV, GOOGLE_CAST, ALEXA_BRIDGE, IR, BLUETOOTH, ANDROID_NATIVE y DESKTOP_NATIVE.
Acciones modeladas: ON, OFF, TOGGLE, SET_BRIGHTNESS, SET_COLOR, SET_VOLUME, MUTE, UNMUTE, PLAY, PAUSE, STOP, NEXT, PREVIOUS, OPEN_APP, SET_CHANNEL, SET_INPUT, SET_TEMPERATURE, SET_MODE, LOCK, UNLOCK, REBOOT, IDENTIFY y GET_STATE.
Device Resolver puntúa nombre, familia, habitación/zona, disponibilidad online, protocolo, uso reciente y favoritos. Normaliza variantes en español (incluidos acentos y alias de habitaciones), usa la actividad reciente para desempatar candidatos cercanos y nunca inventa un dispositivo: si no hay una coincidencia suficientemente clara devuelve NOT_FOUND; si hay ambigüedad devuelve AMBIGUOUS y una pregunta de aclaración.
Matter, Home Assistant, MQTT, Cast, Alexa, IR y electrodomésticos permanecen correctamente marcados como PARTIAL cuando falta el adaptador o gateway físico.

## 7. Seguridad

Prompt Boundary inspecciona intentos de convertir texto no confiable en acciones privilegiadas.
Consent Policy trabaja con LOW, MEDIUM, HIGH y CRITICAL; las decisiones son ALLOW, CONFIRM o DENY.
Secret Boundary evita que secretos entren en prompts y traces.
Audit Integrity asocia operaciones a request IDs y fingerprints.
Undo Guard detecta acciones con reversibilidad limitada.

## 8. Investigación y navegador

Browser Context representa URL, título, selección, texto visible, tab ID y timestamp.
Browser Agent genera planes estructurados para navegación con observación y verificación.
Deep Research Planner descompone preguntas en subpreguntas y prepara política de fuentes y contraste.

## 9. Continuidad multiplataforma

Continuity Capsule transporta tarea, conversación, dispositivos de origen y destino, estado, Skills pendientes y TTL.
Handoff Planner selecciona el companion compatible usando capacidad, tipo preferido, disponibilidad y salud.

## 10. Salud y latencia

Device Health evalúa online/offline, stale heartbeat, latencia, score y razones.
Latency Budget trabaja con NORMAL, URGENT, RESEARCH y HANDS_FREE.
Event Bus incluye tareas, dispositivos, Skills, memorias, handoff, confirmaciones y emergency stop.

## 11. Notificaciones

Notification Router conoce IN_APP, WEB, ANDROID y DESKTOP, con prioridad y acciones seguras.

## 12. Visuales 3D

Visual Director genera un estado visual determinista con modo, estado, profundidad 3D, intensidad, velocidad orbital, partículas, glow, acento, movimiento y etiquetas.
Web: núcleo orbital 3D interactivo con perspective, transform-style, anillos, partículas, glow y tilt con puntero.
PC: mascota 3D existente más tres órbitas independientes y glow central.
Android: núcleo orbital animado con transformaciones X/Y/Z y mascota mini.
La identidad visual responde a idle, listening, thinking, executing, speaking, success, warning, error y offline.

## 13. Web

Autenticación, registro, recuperación, sesión persistente, chat con streaming SSE, historial, memoria, perfil, preferencias, dispositivos y relay Web.
Atajos: Ctrl/Cmd + K y Ctrl/Cmd + 1…7.
La capa API del cliente expone Experience Brief, resolución de dispositivos, escenas, Skill Studio y visuales orbitales.

## 14. Android

Kotlin/Compose nativo, rol de asistente del sistema, micrófono, VoiceInteractionService, AccessibilityService, observación de UI, scroll, tap por texto, Home/Back/Recents/Notificaciones/Quick Settings y varios paneles de Ajustes.
También incluye chat, historial, memoria, relay, Skill Runtime v1 local, Device Fabric y acceso API a Experience Brief, Device Resolver, Scene Engine, Skill Studio y Visual Director.

## 15. PC

Tauri/React nativo, sesión segura, chat/streaming, historial, memoria, perfil, preferencias, dispositivos, relay, system info, reveal path, clipboard, scroll, focus chat y Skill Runtime allowlisted.
La nueva capa Desktop expone Experience Brief, Device Resolver, Scene Engine, Skill Studio y Visual Director. La portada combina la mascota 3D con una escena orbital.

## 16. API completa

El Core mantiene las rutas del Experience Core; esta tanda cambia la semántica interna del Scene Engine sin añadir una ruta nueva.

- GET /v1/features
- POST /v1/agent/plan
- POST /v1/context/adaptive
- POST /v1/memory/candidates
- POST /v1/research/plan
- POST /v1/continuity/capsule
- POST /v1/continuity/validate
- POST /v1/routines/preview
- POST /v1/security/consent
- POST /v1/tasks/create
- POST /v1/tasks/transition
- POST /v1/devices/health
- POST /v1/memory/rank
- POST /v1/notifications/preview
- POST /v1/automation/policy
- POST /v1/browser/context
- POST /v1/offline-queue/preview
- POST /v1/offline-queue/create
- POST /v1/offline-queue/transition
- POST /v1/browser/plan
- POST /v1/handoff/select
- POST /v1/skills/macro
- POST /v1/skills/repair
- POST /v1/devices/fabric/intent
- GET /v1/devices/fabric/protocols
- POST /v1/devices/fabric/compile
- POST /v1/experience/brief
- POST /v1/experience/persona
- POST /v1/memory/lifecycle
- POST /v1/devices/resolve
- POST /v1/automation/scene/compile
- POST /v1/skills/studio
- POST /v1/visuals/orbit
- POST /v1/agent/suggestions
- GET /v1/health
- GET /v1/capabilities
- GET /v1/automation/catalog
- POST /v1/automation/plan
- GET /v1/skills/catalog
- POST /v1/skills/compose
- POST /v1/skills/preview
- POST /v1/skills/execute
- POST /v1/skills/validate
- GET /v1/skills
- POST /v1/capabilities/route
- POST /v1/devices/fabric/execute
- POST /v1/relay/commands
- GET /v1/relay/commands
- POST /v1/relay/commands/:id/claim
- PATCH /v1/relay/commands/:id
- GET /v1/profile
- PATCH /v1/profile
- GET /v1/conversations
- POST /v1/conversations
- GET /v1/conversations/:id
- PATCH /v1/conversations/:id
- DELETE /v1/conversations/:id
- GET /v1/conversations/:id/messages
- GET /v1/memories
- POST /v1/memories
- PATCH /v1/memories/:id
- DELETE /v1/memories/:id
- GET /v1/preferences
- PATCH /v1/preferences
- GET /v1/devices
- POST /v1/devices
- POST /v1/tools/:name
- POST /v1/chat
- POST /v1/chat/stream

## 17. Catálogo de capacidades

El registro contiene 82 capacidades en 0.8.0. Se conserva el criterio AVAILABLE/PARTIAL/PLANNED para no vender integraciones inexistentes como si ya fueran hardware funcional.
Entre las capacidades registradas están personalidad adaptativa, memoria, context router, capability negotiation, Skill Factory, dry-run, recovery, audit, continuity, research, routines, handoff, browser agent, offline queue, consent, device health, Device Fabric, natural device intents, device resolution, scene orchestrator, Skill Studio, visual state engine, Experience Brief y cross-device scenes.

## 18. Pruebas añadidas en esta tanda

Polaris API/tests/experienceLayer.test.ts cubre adaptación de personalidad, detección de memoria repetida, compilación de escenas con riesgo y determinismo del motor visual.\nPolaris API/tests/deviceResolver.test.ts cubre resolución por familia/habitación, desempate por uso reciente y rechazo de referencias no relacionadas.\nPolaris API/tests/sceneEngine.test.ts cubre idempotencia determinista, límites de retraso, rollback y confirmación de escenas de alto impacto.

## 19. Qué no debe marcarse todavía como conectado físicamente

Los contratos y rutas para Matter, Home Assistant, MQTT, Google Cast/Chromecast, Alexa, IR y muchos electrodomésticos ya están estructurados, pero su integración física depende de adaptadores, gateways, SDKs y hardware concretos. El registro los mantiene PARTIAL.

## 20. Estado de verificación de esta tanda\n\nSe añadieron la resolución contextual por habitación/zona y el desempate por uso reciente al Device Resolver, junto con pruebas específicas. GitHub Actions no reportó una ejecución asociada a los commits de esta tanda en el momento de la comprobación, por lo que no se declara CI verde hasta disponer de una ejecución real.\n\n## 21. Regla práctica para seguir construyendo Polaris

Cada capacidad nueva debe pasar por cuatro filtros: realidad de la integración, contrato tipado, política de seguridad y verificación posterior. La interfaz no debe anunciar una función física hasta que exista su adaptador nativo o gateway real.