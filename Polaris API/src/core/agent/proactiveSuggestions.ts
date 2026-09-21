export type ProactiveSuggestion = {
  id: string;
  label: string;
  reason: string;
  reversible: boolean;
};

export function suggestNextActions(input: {
  task: string;
  completed?: boolean;
  hasConversation?: boolean;
  deviceCount?: number;
  memoryCount?: number;
}): ProactiveSuggestion[] {
  const result: ProactiveSuggestion[] = [];
  const task = input.task.toLocaleLowerCase("es-PE");

  if (input.completed !== false && /investig|estudia|analiza/.test(task)) {
    result.push({
      id: "save-research",
      label: "Guardar un resumen en memoria",
      reason: "La tarea parece útil como referencia futura.",
      reversible: true
    });
  }

  if (/tv|tele|luz|lampara|router|pc|telefono|celular/.test(task) && (input.deviceCount ?? 0) > 1) {
    result.push({
      id: "resolve-device",
      label: "Confirmar el dispositivo exacto",
      reason: "Hay varios dispositivos y conviene evitar una acción ambigua.",
      reversible: true
    });
  }

  if (input.hasConversation) {
    result.push({
      id: "handoff",
      label: "Continuar esta tarea en otro dispositivo",
      reason: "La conversación ya tiene contexto suficiente para un handoff.",
      reversible: true
    });
  }

  if (input.memoryCount && input.memoryCount > 20) {
    result.push({
      id: "review-memory",
      label: "Revisar memorias antiguas",
      reason: "El espacio de memoria tiene bastantes entradas y puede beneficiarse de limpieza.",
      reversible: true
    });
  }

  return result.slice(0, 4);
}
