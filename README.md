# Polaris IA

Polaris es un asistente personal multiplataforma concebido como un único cerebro con tres clientes:

- Polaris WEB
- Polaris APP
- Polaris Programa PC

El sistema central usa una API propia, Supabase para identidad/datos/memoria y un proveedor de IA desacoplado.

## Estructura

- `Polaris API/` — Core HTTP/API, IA, conversaciones, tools, memoria y seguridad.
- `Polaris WEB/` — cliente web independiente.
- `Polaris APP/` — cliente Android nativo.
- `Polaris Programa PC/` — cliente de escritorio Tauri.
- `packages/contracts/` — contratos y tipos compartidos.
- `supabase/` — configuración y migraciones reproducibles.

## Supabase

Proyecto oficial:

`wkaynoafhjtqkhuvknzf`

La base usa Auth + RLS y actualmente contiene perfiles, preferencias, dispositivos, conversaciones, mensajes, memorias y auditoría.

## Desarrollo

El proyecto usa pnpm 11 y Node 22. La API requiere las variables de `Polaris API/.env.example`; los clientes sólo deben recibir valores públicos.

Nunca subir:

- `.env`
- API keys privadas
- service role keys
- tokens

## Render

Se crearon servicios separados para:

- `polaris-api`
- `polaris-web`

La configuración de producción depende todavía de las variables privadas del proveedor de IA. El workspace de Render también puede quedar temporalmente bloqueado cuando se agota su cuota de minutos de build.

## Estado

Consultar `docs/STATUS.md`.

## Roadmap

1. Core
2. Identidad
3. Cuenta y memoria
4. Multidispositivo
5. Polaris Robot
6. IA → Tools → Robot
7. Voz
8. Visión
9. Automatización de PC
10. Agentes y rutinas


### Release 0.9.0

El flujo de release genera artefactos Web, Android y Desktop y los publica cuando la compilación completa termina correctamente.
