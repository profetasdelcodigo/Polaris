export interface PolarisFeature {
  id: string;
  name: string;
  category: "INTELLIGENCE" | "MEMORY" | "AUTOMATION" | "RESEARCH" | "MULTIPLATFORM" | "SECURITY" | "PRODUCTIVITY";
  status: "AVAILABLE" | "PARTIAL" | "PLANNED";
  description: string;
  whyItMatters: string;
}

export const polarisFeatureRegistry: readonly PolarisFeature[] = [
  ["adaptive-personality", "Personalidad adaptativa", "INTELLIGENCE", "AVAILABLE", "Cambia modo, tono y profundidad según contexto.", "Hace que el asistente se comporte distinto durante estudio, programación, investigación o urgencias."],
  ["memory-profile", "Perfil de memoria", "MEMORY", "AVAILABLE", "Combina perfil, preferencias y recuerdos relevantes.", "Evita tratar cada conversación como aislada."],
  ["context-router", "Enrutador de contexto", "INTELLIGENCE", "AVAILABLE", "Selecciona el contexto mínimo útil antes de responder o ejecutar.", "Reduce acciones a ciegas y ruido innecesario."],
  ["capability-negotiation", "Negociación de capacidades", "MULTIPLATFORM", "AVAILABLE", "Descubre qué dispositivo puede ejecutar cada capacidad.", "Permite delegar en lugar de fingir compatibilidad."],
  ["skill-factory", "Fábrica de Skills", "AUTOMATION", "AVAILABLE", "Convierte intenciones permitidas en microprogramas validados.", "Permite automatizaciones reutilizables sin código arbitrario."],
  ["skill-dry-run", "Vista previa de Skill", "SECURITY", "AVAILABLE", "Muestra los pasos previstos antes de ejecutar.", "Reduce sorpresas y facilita confirmaciones."],
  ["recovery-engine", "Motor de recuperación", "AUTOMATION", "AVAILABLE", "Define reintentos, fallbacks y condiciones de parada.", "Una acción que falla no se convierte en un falso éxito."],
  ["execution-audit", "Auditoría de ejecución", "SECURITY", "AVAILABLE", "Genera una traza identificable por operación.", "Permite saber qué intentó hacer Polaris y qué verificó."],
  ["continuity-capsule", "Cápsula de continuidad", "MULTIPLATFORM", "AVAILABLE", "Empaqueta el estado de una tarea para retomarla en otro dispositivo.", "Permite continuar tareas entre Android, PC y Web."],
  ["deep-research-planner", "Planificador de investigación profunda", "RESEARCH", "AVAILABLE", "Descompone preguntas y prepara búsquedas y verificación.", "Convierte investigación en un proceso reproducible."],
  ["routine-builder", "Constructor de rutinas", "PRODUCTIVITY", "AVAILABLE", "Define triggers y secuencias de capacidades.", "Permite comandos personales reutilizables."],
  ["command-aliases", "Alias de comandos", "PRODUCTIVITY", "AVAILABLE", "Relaciona frases del usuario con acciones conocidas.", "Hace las invocaciones más naturales."],
  ["focus-mode", "Modo concentración", "PRODUCTIVITY", "PARTIAL", "Agrupa comportamiento de voz, respuestas y automatizaciones para concentrarse.", "Une personalidad y control del dispositivo en una sola intención."],
  ["proactive-nudges", "Avisos proactivos", "PRODUCTIVITY", "PARTIAL", "Prepara recordatorios y avisos basados en eventos autorizados.", "Polaris puede ayudar sin esperar siempre una pregunta."],
  ["device-handoff", "Handoff de dispositivo", "MULTIPLATFORM", "AVAILABLE", "Transfiere una tarea entre companions.", "Convierte los dispositivos en una experiencia continua."],
  ["screen-context", "Contexto de pantalla", "MULTIPLATFORM", "PARTIAL", "Permite adjuntar una captura o descripción del estado visible.", "Da a Polaris una representación verificable de la UI."],
  ["clipboard-bridge", "Puente de portapapeles", "MULTIPLATFORM", "PARTIAL", "Transfiere texto entre dispositivos autorizados.", "Acelera tareas Android ↔ PC ↔ Web."],
  ["file-workspace", "Workspace de archivos", "MULTIPLATFORM", "PARTIAL", "Centraliza referencias a archivos autorizados para una tarea.", "Evita perder el contexto de documentos."],
  ["browser-agent", "Agente de navegador", "RESEARCH", "PARTIAL", "Prepara navegación estructurada con observación y verificación.", "Permite investigación y automatización sin depender de una sola URL."],
  ["app-orchestration", "Orquestación de aplicaciones", "AUTOMATION", "PARTIAL", "Coordina aplicaciones nativas del dispositivo mediante capacidades declaradas.", "Hace posibles flujos de varios pasos."],
  ["task-checkpoints", "Puntos de control", "AUTOMATION", "AVAILABLE", "Marca estados intermedios de una tarea.", "Permite reanudar desde el último estado válido."],
  ["resumable-tasks", "Tareas reanudables", "AUTOMATION", "AVAILABLE", "Reanuda tareas a partir de contexto y checkpoints.", "Una desconexión no tiene que reiniciar todo."],
  ["undo-guard", "Protección de reversión", "SECURITY", "AVAILABLE", "Detecta cuándo una acción tiene reversibilidad limitada.", "Aumenta la seguridad de las automatizaciones."],
  ["privacy-center", "Centro de privacidad", "SECURITY", "PARTIAL", "Expone permisos, dispositivos y preferencias de privacidad.", "El usuario conserva control sobre las capacidades."],
  ["emergency-stop", "Parada de emergencia", "SECURITY", "AVAILABLE", "Permite marcar una sesión de automatización como cancelada.", "Da un mecanismo de interrupción explícito."],
  ["consent-policy", "Política de consentimiento", "SECURITY", "AVAILABLE", "Decide si una acción se permite, requiere confirmación o debe bloquearse.", "Evita que el modelo decida por sí solo cuándo puede actuar."],
  ["task-state", "Estado de tareas", "AUTOMATION", "AVAILABLE", "Mantiene progreso, checkpoints, pausas y cancelación de una tarea.", "Permite tareas largas y reanudables."],
  ["device-health", "Salud de dispositivos", "MULTIPLATFORM", "AVAILABLE", "Evalúa online, stale, latencia y score de un companion.", "Ayuda a elegir una ruta realista."],
  ["memory-ranking", "Ranking de memoria", "MEMORY", "AVAILABLE", "Ordena memorias por relevancia, importancia y frescura.", "Evita llenar el contexto con recuerdos irrelevantes."],
  ["event-bus", "Bus de eventos", "AUTOMATION", "AVAILABLE", "Distribuye eventos internos tipados del Core.", "Desacopla notificaciones, auditoría y automatización."],
  ["notification-router", "Router de notificaciones", "PRODUCTIVITY", "AVAILABLE", "Selecciona un canal y prioridad para avisos de Polaris.", "Permite que el mismo evento llegue a Web, Android o PC."],
  ["automation-policy", "Política de automatización", "SECURITY", "AVAILABLE", "Comprueba intención, permisos, reversibilidad y riesgo antes de actuar.", "Añade una barrera independiente del modelo."],
  ["browser-context", "Contexto del navegador", "RESEARCH", "AVAILABLE", "Representa URL, pestaña, selección y texto visible.", "Prepara integración profunda con navegador sin convertirla en una falsa capacidad."],
  ["task-cancel", "Cancelación de tareas", "AUTOMATION", "AVAILABLE", "Permite detener una tarea antes de pasos posteriores.", "El usuario puede recuperar control durante automatizaciones."],
  ["task-checkpointing", "Checkpointing avanzado", "AUTOMATION", "AVAILABLE", "Guarda estados intermedios de una tarea.", "Reduce trabajo perdido tras desconexiones."],
  ["session-approval", "Aprobación de sesión", "SECURITY", "AVAILABLE", "Representa consentimiento temporal para una categoría de acciones.", "Evita pedir confirmación repetitiva sin eliminar el control."],
  ["device-selection-score", "Puntuación de dispositivo", "MULTIPLATFORM", "AVAILABLE", "Combina disponibilidad y salud para seleccionar companion.", "Mejora el handoff entre dispositivos."],
  ["notification-actions", "Acciones en notificaciones", "PRODUCTIVITY", "PARTIAL", "Adjunta intents seguros a notificaciones.", "Convierte un aviso en una acción contextual."],
  ["browser-tab-handoff", "Handoff de pestaña", "MULTIPLATFORM", "PARTIAL", "Representa el contexto de una pestaña para continuarlo en otro dispositivo.", "Permite continuar investigación sin empezar de cero."],
  ["screen-understanding", "Comprensión de pantalla", "MULTIPLATFORM", "PARTIAL", "Consume una descripción o captura autorizada de la superficie visible.", "Da contexto visual verificable a las acciones."],
  ["voice-session", "Sesión de voz", "MULTIPLATFORM", "PARTIAL", "Mantiene un ciclo de escucha, pensamiento, ejecución y respuesta.", "Acerca Polaris a una experiencia de asistente manos libres."],
  ["wake-invocation", "Invocación del asistente", "MULTIPLATFORM", "PARTIAL", "Integra el acceso rápido del sistema cuando la plataforma lo permite.", "Reduce fricción para llamar a Polaris."],
  ["offline-queue", "Cola offline", "MULTIPLATFORM", "PARTIAL", "Conserva tareas seguras para reintentarlas cuando vuelva la conexión.", "Hace resistente la experiencia ante pérdida de red."],
  ["network-awareness", "Conciencia de red", "MULTIPLATFORM", "PARTIAL", "Clasifica conectividad antes de enviar tareas remotas.", "Evita handoffs innecesarios en redes inestables."],
  ["privacy-redaction", "Redacción de contexto", "SECURITY", "PARTIAL", "Filtra datos marcados como privados antes de enviar contexto a otros servicios.", "Reduce exposición accidental."],
  ["secret-boundary", "Frontera de secretos", "SECURITY", "AVAILABLE", "Mantiene credenciales fuera de prompts, trazas y respuestas.", "Protege secretos aunque el agente falle."],
  ["audit-integrity", "Integridad de auditoría", "SECURITY", "AVAILABLE", "Permite asociar operaciones con identificadores y fingerprints.", "Hace rastreable qué programa se intentó ejecutar."],
  ["research-evidence", "Registro de evidencia", "RESEARCH", "PARTIAL", "Asocia fuentes y fechas con hallazgos de investigación.", "Permite distinguir evidencia de texto generado."],
  ["research-synthesis", "Síntesis de investigación", "RESEARCH", "PARTIAL", "Combina hallazgos contrastados en una salida estructurada.", "Convierte búsquedas en un informe reproducible."]
].map(([id, name, category, status, description, whyItMatters]) => ({
  id,
  name,
  category: category as PolarisFeature["category"],
  status: status as PolarisFeature["status"],
  description,
  whyItMatters
}));

export function featureRegistrySummary() {
  return {
    count: polarisFeatureRegistry.length,
    available: polarisFeatureRegistry.filter((feature) => feature.status === "AVAILABLE").length,
    partial: polarisFeatureRegistry.filter((feature) => feature.status === "PARTIAL").length,
    planned: polarisFeatureRegistry.filter((feature) => feature.status === "PLANNED").length
  };
}
