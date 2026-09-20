const clientKey = "polaris.desktop.client-id";

export function getOrCreateDesktopClientId(): string {
  const existing = window.localStorage.getItem(clientKey);
  if (existing) return existing;

  const id = crypto.randomUUID();
  window.localStorage.setItem(clientKey, id);
  return id;
}
