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
  ["emergency-stop", "Parada de emergencia", "SECURITY", "AVAILABLE", "Permite marcar una sesión de automatización como cancelada.", "Da un mecanismo de interrupción explícito."]
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
