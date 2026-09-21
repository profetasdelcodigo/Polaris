export interface BrowserContext {
  url?: string;
  title?: string;
  selectedText?: string;
  visibleText?: string;
  tabId?: string;
  capturedAt: string;
}

export function createBrowserContext(input: Omit<BrowserContext, "capturedAt">): BrowserContext {
  return {
    ...input,
    url: input.url?.slice(0, 4_000),
    title: input.title?.slice(0, 500),
    selectedText: input.selectedText?.slice(0, 20_000),
    visibleText: input.visibleText?.slice(0, 40_000),
    capturedAt: new Date().toISOString()
  };
}

export function browserContextSummary(context: BrowserContext): string {
  return [
    context.title ? "Título: " + context.title : "",
    context.url ? "URL: " + context.url : "",
    context.selectedText ? "Selección: " + context.selectedText.slice(0, 2_000) : "",
    context.visibleText ? "Contenido visible: " + context.visibleText.slice(0, 5_000) : ""
  ].filter(Boolean).join("\n");
}
