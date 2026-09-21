# Polaris — pipeline de personaje 3D

## Objetivo

Usar un único personaje 3D riggeado y optimizado como identidad visual de Polaris en Android, Web y PC.

## Pipeline recomendado

1. **Generación del modelo**
   - Opción web sencilla: Meshy, usando preferentemente el flujo/descarga disponible en su plan gratuito para un modelo inicial.
   - Alternativa local: TripoSR si queremos evitar depender de una plataforma externa; genera una malla desde una sola imagen y tiene licencia MIT.
   - Para conservar mejor la forma del personaje, usar una imagen frontal limpia y, cuando la herramienta lo permita, varias vistas.

2. **Rig / esqueleto**
   - Para Polaris humanoide, usar Mixamo para auto-rig y skeleton humanoide.
   - No usar una nube de puntos, NeRF o Gaussian Splat como activo principal de animación: necesitamos una malla con pesos de skinning y huesos.
   - Si el diseño tiene partes no humanas importantes (alas, cola, brazos mecánicos especiales, etc.), terminar el rig en Blender.

3. **Animación**
   - Animaciones estándar: Mixamo.
   - Movimientos personalizados desde vídeo: DeepMotion Animate 3D o Plask.
   - Guardar los clips en un formato compatible, preferentemente GLB para runtime y FBX como formato de trabajo cuando sea necesario.

4. **Integración**
   - Activo final recomendado para Polaris: polaris.glb.
   - Animaciones mínimas:
     - Idle
     - Listening
     - Thinking
     - Speaking
     - Happy
     - Confused
     - Error
     - Wave
   - El Core/cliente puede seleccionar el clip según el estado de Polaris.

## Convención de estados

- idle → Idle
- listening → Listening
- thinking → Thinking
- speaking → Speaking
- success → Happy
- error → Error
- greeting → Wave
- confused → Confused

## Requisitos para el activo

- Malla skinned con armature/skeleton.
- UVs y texturas embebidas o empaquetables.
- GLB final probado en Web, Android y escritorio.
- Evitar geometría innecesariamente pesada para el teléfono.
- Mantener una sola identidad/escala entre plataformas.

## Nota sobre licencias

Las condiciones de los servicios externos cambian con el plan. Antes de publicar Polaris, revisar la licencia del activo concreto y conservar atribución cuando el plan gratuito la exija.

## Referencias de herramientas

- Meshy: generación Image-to-3D.
- TripoSR: alternativa local/open-source para Image-to-3D.
- Mixamo: rig humanoide y biblioteca de animaciones.
- DeepMotion Animate 3D: mocap desde vídeo y retargeting a personajes personalizados.
- Plask: mocap desde vídeo y exportación de FBX/GLB/BVH.
- Blender: limpieza, ajuste de rig, materiales y conversión/optimización final.