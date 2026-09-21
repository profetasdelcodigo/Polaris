export type NotificationChannel = "IN_APP" | "WEB" | "ANDROID" | "DESKTOP";

export interface PolarisNotification {
  id: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  priority: "LOW" | "NORMAL" | "HIGH";
  expiresAt?: string;
  action?: { label: string; intent: string };
}

export function routeNotification(input: {
  title: string;
  body: string;
  preferredChannel?: NotificationChannel;
  urgent?: boolean;
  action?: { label: string; intent: string };
}): PolarisNotification {
  return {
    id: "notif_" + Math.random().toString(36).slice(2, 12),
    title: input.title.slice(0, 120),
    body: input.body.slice(0, 2_000),
    channel: input.preferredChannel ?? "IN_APP",
    priority: input.urgent ? "HIGH" : "NORMAL",
    ...(input.action ? { action: input.action } : {})
  };
}
