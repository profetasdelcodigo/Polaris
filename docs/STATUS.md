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

## Próximo objetivo

Cerrar Fase 1 con una prueba real del proveedor de IA y contratos/tests finales. Después, ejecutar la prueba real Web → Android → PC y verificar expiración/refresh de sesión. Luego completar el planificador de automatización multi-paso, observación/localización/verificación/recuperación y el puente seguro Android ↔ Core. Después: voz continua/TTS, memoria semántica, visión/OCR, automatización PC con permisos, sincronización realtime cuando aporte valor y una pasada final de diseño, accesibilidad, rendimiento, pruebas y empaquetado. No se declarará 100% hasta que cada bloque tenga implementación y verificación real. CI Android volvió a confirmar `:app:assembleDebug` después de TTS y modo continuo. Las capacidades de sistema/automatización inspiradas en ARTEMIS quedan separadas como módulo posterior y requieren permisos explícitos.
