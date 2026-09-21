# Polaris — Estado técnico

Fecha de referencia: 2026-09-20

## Fases

### Fase 1 — Polaris Core: 75%

Implementado:
- API Fastify
- autenticación de requests con Supabase
- abstracción AIProvider
- OpenAI Responses streaming
- endpoint de chat normal
- endpoint de streaming
- context engine
- conversation engine
- tools básicas
- health/capabilities
- rate limiting
- validación Zod
- manejo de errores

Pendiente para cerrar la fase:
- prueba real end-to-end con una API key válida
- verificación de builds de Node/Web/PC mediante CI
- prueba real del function calling contra una API key válida
- endurecimiento final de contratos y tests

### Fase 2 — Identidad: avance funcional

Implementado:
- PolarisIdentity
- personalidad base
- estados del asistente
- identidad visual en Web
- identidad visual en PC
- paleta Polaris unificada
- mascota animada en Web/PC/Android
- punto de entrada como asistente del sistema en Android mediante ROLE_ASSISTANT + VoiceInteractionService
- sesión flotante del asistente sobre la aplicación actual, con tema translúcido y oscurecimiento del fondo
- sesión de asistente capaz de enviar texto autenticado al endpoint /v1/chat del Core
- captura de voz mediante SpeechRecognizer, priorizando reconocimiento en dispositivo cuando está disponible
- respuestas habladas en español mediante Android TextToSpeech
- modo de conversación continua con escucha posterior a cada respuesta
- feedback visual de invocación del asistente mediante la API oficial de Android
- automatización local Android inicial, con Accesibilidad explícitamente activada por el usuario
- acciones locales reales y acotadas: volver, inicio, notificaciones, Ajustes, desplazamiento y pulsación de elementos visibles

Pendiente:
- experiencia de voz conversacional continua
- modelo 3D real compartido en lugar de las aproximaciones actuales
- configuración avanzada de personalidad

### Fase 4 — Automatización segura: 55%

Implementado:
- capa local de automatización separada del Core
- AccessibilityService con permiso explícito del usuario
- parser determinista de órdenes Android de bajo riesgo
- planificador local acotado de hasta 8 acciones con ejecución secuencial y corte ante fallo
- navegación real: atrás, inicio, recientes, notificaciones y ajustes rápidos
- apertura de Ajustes, Wi-Fi y Bluetooth
- desplazamiento de contenedores visibles
- pulsación de elementos visibles por texto/descripción
- fallback al Core cuando la orden no es una acción local reconocida
- ciclo local de ejecución con resultado verificable por acción

Pendiente:
- observar → localizar → ejecutar → verificar → recuperar como ciclo formal
- conexión segura Android ↔ Core para automatizaciones aprobadas
- visión/OCR como fallback
- automatización avanzada de PC con confirmaciones explícitas
- pruebas instrumentadas en dispositivo real

### Fase 3 — Cuenta + Memoria: avance funcional

Implementado:
- Supabase Auth
- profiles
- preferences
- devices
- conversations
- messages
- memories
- RLS
- ownership
- CRUD de memoria en API
- búsqueda textual básica de memoria
- historial Web/PC
- sincronización mediante backend compartido
- edición real de perfil en Web y PC contra /v1/profile
- navegación rápida Web/PC por teclado
- historial real en Android
- memoria real en Android, con creación y eliminación
- cliente Core Android ampliado para conversaciones y memorias

Pendiente:
- prueba real de sincronización Web → Android → PC
- suscripción Realtime equivalente en Android/PC
- memoria semántica/vectorial
- exportación/borrado de datos
- sincronización realtime donde aporte valor

## Infraestructura

Supabase:
- ACTIVE_HEALTHY
- Security Advisor: limpio
- Performance Advisor: sólo índices actualmente sin uso por falta de carga real

GitHub:
- main sincronizada
- repo: profetasdelcodigo/Polaris

Render:
- servicio polaris-api creado
- servicio polaris-web creado
- ambos en free
- último deploy bloqueado antes del build porque el workspace agotó los minutos de build del período
- queda pendiente configurar el secreto OPENAI_API_KEY

CI:
- workflow GitHub para typecheck/test/build de Core + Web + PC
- workflow Android para assembleDebug

## Verificación reciente

- CI Node/Core: SUCCESS en el commit que ajustó los fixtures de contexto.
- CI Android: SUCCESS en el commit que reparó la automatización; `:app:assembleDebug` completó correctamente.
- Se corrigieron errores reales detectados por CI: servicio de automatización duplicado, referencias obsoletas, atributos de tema, declaración de botones de la sesión y acceso a Supabase Auth.


## Estado universal de automatización

Implementado en esta iteración:
- Router universal de tareas con ciclo OBSERVE → LOCATE → ACT → VERIFY → RECOVER.
- Endpoint autenticado `POST /v1/automation/plan`.
- Relay autenticado entre dispositivos mediante comandos con expiración/claim/resultado.
- Ejecución remota real en Android para navegación, ajustes, scroll, pulsaciones y observación de pantalla.
- Ejecución remota real en PC para abrir URLs, revelar rutas y consultar información del sistema.
- Sesión Web ejecutable: registro de dispositivo, relay autenticado y ejecución de `web.open_url`, con fallback a navegación en la pestaña actual si el navegador bloquea una nueva pestaña.
- Handoff seguro model-callable: el Core puede delegar automáticamente acciones limitadas a Web/Android/PC sin exponer shell, archivos destructivos ni taps arbitrarios.
- El cliente Android registra su dispositivo y consume órdenes pendientes.
- El cliente PC registra su dispositivo y consume órdenes pendientes.
- Catálogo declarativo generado: 48.000 recetas únicas antes de herramientas incorporadas; el endpoint expone capacidad por plataforma.
- Cobertura de catálogo actual por plataforma: Web 40.800, Android 43.200, Desktop 43.200 y Robot 2.400 recetas declarativas.
- Se mantiene separación explícita entre `AVAILABLE`, `PARTIAL` y `PLANNED`; una receta de catálogo no se considera una función ejecutable por sí sola.

Dirección del siguiente bloque:
- ampliar observación/visión y localización semántica,
- cerrar más acciones nativas de PC con permisos explícitos,
- conectar más comandos Android con el relay,
- añadir ejecución verificada multi-paso con recuperación,
- integrar el activo 3D real y mapear sus animaciones a estados del Core,
- ampliar herramientas Web con APIs del navegador y companions cuando los permisos estén disponibles.

### Skill Runtime v1 — endurecimiento

Implementado en el commit actual:
- validador server-side autenticado para Polaris Skill v1;
- contrato único de 8 acciones allowlisted para el runtime de PC;
- límites server-side: 12 pasos, 10 s por espera y 32 KB serializados;
- endpoint `POST /v1/skills/validate` para validar un microprograma antes de enviarlo al dispositivo;
- se mantiene la regla: Polaris puede generar un microprograma estructurado, pero nunca shell, JavaScript arbitrario ni código nativo ejecutable directamente desde la IA.

Pendiente de esta capa:
- conectar validación server-side al flujo de ejecución para que el cliente no sea el único punto de enforcement;
- añadir pruebas E2E del ciclo generar → validar → relay → ejecutar → verificar en PC real.

## Próximo objetivo

Cerrar Fase 1 con una prueba real del proveedor de IA y contratos/tests finales. Después, ejecutar la prueba real Web → Android → PC y verificar expiración/refresh de sesión. Luego completar el planificador de automatización multi-paso, observación/localización/verificación/recuperación y el puente seguro Android ↔ Core. Después: voz continua/TTS, memoria semántica, visión/OCR, automatización PC con permisos, sincronización realtime cuando aporte valor y una pasada final de diseño, accesibilidad, rendimiento, pruebas y empaquetado. No se declarará 100% hasta que cada bloque tenga implementación y verificación real. CI Android volvió a confirmar `:app:assembleDebug` después de TTS y modo continuo. CI Node/Web/PC: SUCCESS tras integrar Realtime Web. Las capacidades de sistema/automatización inspiradas en ARTEMIS quedan separadas como módulo posterior y requieren permisos explícitos.
