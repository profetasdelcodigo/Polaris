const clientKey = 'polaris.web.client-id';

export function getOrCreateWebClientId(): string {
  const existing = window.localStorage.getItem(clientKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(clientKey, id);
  return id;
}
