export type PolarisIntent =
  | "CHAT" | "ACTION" | "RESEARCH" | "MEMORY" | "DEVICE_CONTROL" | "NAVIGATION"
  | "AUTOMATION" | "SETTINGS" | "CANCEL" | "UNKNOWN";

const normalize=(v:string)=>v.toLocaleLowerCase("es-PE").normalize("NFD").replace(/[\u0300-\u036f]/g,"");

export function classifyIntent(text:string): { intent: PolarisIntent; confidence:number } {
  const t=normalize(text);
  if (/(cancela|detente|para todo|stop)/.test(t)) return {intent:"CANCEL",confidence:.98};
  if (/(investiga|fuentes|paper|evidencia|compara)/.test(t)) return {intent:"RESEARCH",confidence:.94};
  if (/(recuerda|memoriza|olvida|memoria)/.test(t)) return {intent:"MEMORY",confidence:.94};
  if (/(abre|cierra|pulsa|toca|desplaza|notificaciones|ajustes|wifi|bluetooth)/.test(t)) return {intent:"DEVICE_CONTROL",confidence:.9};
  if (/(automatiza|rutina|cada dia|cada día|cuando ocurra)/.test(t)) return {intent:"AUTOMATION",confidence:.9};
  if (/(configura|preferencias|tema|voz|idioma)/.test(t)) return {intent:"SETTINGS",confidence:.86};
  if (/(navega|busca|url|youtube|google|github)/.test(t)) return {intent:"NAVIGATION",confidence:.86};
  if (/(haz|ejecuta|realiza|crea|envia|envía)/.test(t)) return {intent:"ACTION",confidence:.75};
  if (text.trim()) return {intent:"CHAT",confidence:.6};
  return {intent:"UNKNOWN",confidence:1};
}
