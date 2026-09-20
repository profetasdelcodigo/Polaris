import { config } from "./config";
import type {
  Conversation,
  Device,
  Memory,
  PolarisMessage,
  Preferences,
  Profile
} from "./models";
import { supabase } from "./supabase";
import { getOrCreateDesktopClientId } from "./device";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = "INTERNAL_ERROR",
    public readonly status = 500
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonObject = Record<string, unknown>;

async function accessToken(): Promise<string> {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) throw new ApiError("Tu sesión ha expirado. Inicia sesión nuevamente.", "AUTH_ERROR", 401);
  return session.access_token;
}

async function readProblem(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string }; code?: string; message?: string };
    return new ApiError(
      payload.error?.message ?? payload.message ?? "La solicitud no pudo completarse.",
      payload.error?.code ?? payload.code ?? "INTERNAL_ERROR",
      response.status
    );
  } catch {
    return new ApiError("La solicitud no pudo completarse.", "NETWORK_ERROR", response.status);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });
  } catch {
    throw new ApiError("No se pudo conectar con Polaris API.", "NETWORK_ERROR", 0);
  }

  if (!response.ok) throw await readProblem(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function asCollection<T>(value: T[] | { data?: T[]; items?: T[] }): T[] {
  return Array.isArray(value) ? value : value.data ?? value.items ?? [];
}

export const api = {
  health: () => fetch(`${config.apiUrl}/v1/health`).then((response) => response.json() as Promise<JsonObject>),

  async listConversations(): Promise<Conversation[]> {
    return asCollection(await request<Conversation[] | { data?: Conversation[] }>("/v1/conversations"));
  },

  createConversation(title: string): Promise<Conversation> {
    return request("/v1/conversations", { method: "POST", body: JSON.stringify({ title }) });
  },

  listMessages(conversationId: string): Promise<PolarisMessage[]> {
    return request(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`);
  },

  deleteConversation(conversationId: string): Promise<void> {
    return request(`/v1/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
  },

  async listMemories(search?: string): Promise<Memory[]> {
    const query = search ? `?q=${encodeURIComponent(search)}` : "";
    return asCollection(await request<Memory[] | { data?: Memory[] }>(`/v1/memories${query}`));
  },

  createMemory(input: Pick<Memory, "content" | "category" | "importance">): Promise<Memory> {
    return request("/v1/memories", { method: "POST", body: JSON.stringify(input) });
  },

  updateMemory(id: string, input: Partial<Pick<Memory, "content" | "category" | "importance">>): Promise<Memory> {
    return request(`/v1/memories/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  deleteMemory(id: string): Promise<void> {
    return request(`/v1/memories/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  getProfile(): Promise<Profile> {
    return request("/v1/profile");
  },

  updateProfile(input: { display_name: string; timezone: string }): Promise<Profile> {
    return request("/v1/profile", {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  getPreferences(): Promise<Preferences> {
    return request("/v1/preferences");
  },

  updatePreferences(input: Partial<Preferences>): Promise<Preferences> {
    return request("/v1/preferences", { method: "PATCH", body: JSON.stringify(input) });
  },

  async listDevices(): Promise<Device[]> {
    return asCollection(await request<Device[] | { data?: Device[] }>("/v1/devices"));
  },

  registerDesktop(): Promise<Device> {
    return request("/v1/devices", {
      method: "POST",
      body: JSON.stringify({
        clientId: getOrCreateDesktopClientId(),
        name: "Polaris Desktop",
        type: "DESKTOP",
        platform: navigator.platform || "desktop",
        status: "ONLINE",
        metadata: { client: "tauri", version: "0.1.0" }
      })
    });
  }
};

export interface StreamCallbacks {
  onDelta(delta: string): void;
  onToolStarted(name: string): void;
  onToolCompleted(name: string): void;
  onDone(): void;
  onError(error: ApiError): void;
}

function dispatchSseBlock(block: string, callbacks: StreamCallbacks): void {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  if (!dataLines.length) return;
  let payload: JsonObject;
  try {
    payload = JSON.parse(dataLines.join("\n")) as JsonObject;
  } catch {
    return;
  }

  if (event === "message.delta" && typeof payload.delta === "string") {
    callbacks.onDelta(payload.delta);
  } else if (event === "tool.started" && typeof payload.name === "string") {
    callbacks.onToolStarted(payload.name);
  } else if (event === "tool.completed" && typeof payload.name === "string") {
    callbacks.onToolCompleted(payload.name);
  } else if (event === "message.done") {
    callbacks.onDone();
  } else if (event === "error") {
    callbacks.onError(
      new ApiError(
        typeof payload.message === "string" ? payload.message : "La generación falló.",
        typeof payload.code === "string" ? payload.code : "PROVIDER_ERROR",
        502
      )
    );
  }
}

export async function streamChat(
  conversationId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<void> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}/v1/chat/stream`, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ conversationId, content })
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") return;
    throw new ApiError("No se pudo conectar con Polaris API.", "NETWORK_ERROR", 0);
  }

  if (!response.ok) throw await readProblem(response);
  if (!response.body) throw new ApiError("El servidor no habilitó streaming.", "INTERNAL_ERROR", 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = blocks.pop() ?? "";
      blocks.forEach((block) => dispatchSseBlock(block, callbacks));
      if (done) break;
    }
    if (pending.trim()) dispatchSseBlock(pending, callbacks);
  } finally {
    reader.releaseLock();
  }
}
