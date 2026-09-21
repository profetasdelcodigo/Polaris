# Polaris APP

Cliente Android nativo de Polaris IA.

## Stack

- Kotlin 2.2.21
- Android Gradle Plugin 9.4.0
- Jetpack Compose
- Compose BOM 2026.09.00
- Supabase Auth, supabase-kt 3.8.0
- Ktor 3.3.0

## Configuración

Copia los valores de gradle.properties.example a tu gradle.properties local y completa la publishable key de Supabase.

POLARIS_SUPABASE_URL=https://wkaynoafhjtqkhuvknzf.supabase.co
POLARIS_SUPABASE_PUBLISHABLE_KEY=...
POLARIS_API_URL=http://10.0.2.2:8787

La publishable key es adecuada para el cliente. Nunca uses aquí una service role o secret key.

## Desarrollo

Abre la carpeta Polaris APP como proyecto en Android Studio.

Para el emulador, 10.0.2.2 apunta al PC host. Para un teléfono físico, usa la IP LAN del PC donde corre Polaris API.

La aplicación inicial implementa:

- registro
- login
- sesión persistente
- chat contra el Polaris Core

Voz, Bluetooth, memoria visual avanzada, visión y control de robot se implementarán en fases posteriores.


## Polaris 0.9.0

La build Android incluye la identidad Polaris, autenticación, conversación con Core, memoria, relay multidispositivo, ejecución de Skills seguras y VoiceInteractionService. Las acciones que requieren permisos del sistema siguen sujetas a los permisos reales del dispositivo.
