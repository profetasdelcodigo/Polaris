# Polaris — Estado técnico

Fecha de referencia: 2026-09-20

## Fases

### Fase 1 — Polaris Core: 70%

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
- verificación de builds
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
- captura de voz de una sola orden mediante SpeechRecognizer, priorizando reconocimiento en dispositivo cuando está disponible
- feedback visual de invocación del asistente mediante la API oficial de Android
- automatización local Android inicial, con Accesibilidad explícitamente activada por el usuario
- acciones locales reales y acotadas: volver, inicio, notificaciones, Ajustes, desplazamiento y pulsación de elementos visibles

Pendiente:
- experiencia de voz conversacional continua
- modelo 3D real compartido en lugar de las aproximaciones actuales
- configuración avanzada de personalidad

### Fase 4 — Automatización segura: 25%

Implementado:
- capa local de automatización separada del Core
- AccessibilityService con permiso explícito
- ejecución verificable de acciones de navegación de bajo riesgo
- fallback al Core cuando la orden no es una acción local reconocida

Pendiente:
- planificador de tareas multi-paso
- observar → localizar → ejecutar → verificar → recuperar
- conexión segura Android ↔ Core para automatizaciones aprobadas
- visión/OCR como fallback
- automatización avanzada de PC con confirmaciones explícitas

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

## Próximo objetivo

Cerrar Fase 1 con una prueba real del proveedor de IA y contratos/tests finales. Después, ejecutar la prueba real Web → Android → PC y verificar expiración/refresh de sesión. Luego completar el módulo de automatización segura, cerrar sincronización/voz/visión y hacer una pasada final de diseño, accesibilidad, rendimiento, pruebas y empaquetado antes de declarar 100%. Las capacidades de sistema/automatización inspiradas en ARTEMIS quedan separadas como módulo posterior y requieren permisos explícitos.
