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
- tool/function calling nativo del proveedor en lugar de depender únicamente de inferencia determinista
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

Pendiente:
- voz real con permisos de micrófono
- voz real con permisos de micrófono
- modelo 3D real compartido en lugar de las aproximaciones actuales
- configuración avanzada de personalidad

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

Pendiente:
- memoria/historial completos en Android
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

## Próximo objetivo

Cerrar Fase 1 con una prueba real del proveedor de IA y contratos/tests finales. Después, completar Android como cliente multidispositivo: historial + memoria + sesión de asistente conectada al Core. Las capacidades de sistema/automatización inspiradas en ARTEMIS quedan separadas como módulo posterior y requieren permisos explícitos.
