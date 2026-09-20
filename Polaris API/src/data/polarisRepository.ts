import type { Json } from "@polaris/contracts";
import type { AuthenticatedContext } from "../auth.js";
import { PolarisError } from "../errors.js";

type DbContext = Pick<AuthenticatedContext, "db" | "user">;
type MessageRole = "user" | "assistant" | "system" | "tool";
type MessageStatus = "pending" | "streaming" | "completed" | "failed" | "cancelled";
type MemoryCategory = "PERSONAL" | "PREFERENCE" | "PROJECT" | "CONTEXT" | "FACT" | "GOAL";
type DeviceType = "WEB" | "ANDROID" | "DESKTOP" | "ROBOT";

function databaseError(error: { message: string; code?: string }): PolarisError {
  return new PolarisError("DATABASE_ERROR", "La base de datos no pudo completar la operación.", 503, {
    expose: false,
    cause: error
  });
}

function requireData<T>(data: T | null, error: { message: string; code?: string } | null): T {
  if (error) throw databaseError(error);
  if (!data) throw new PolarisError("NOT_FOUND", "No se encontró el recurso solicitado.", 404);
  return data;
}

export async function listConversations(
  context: DbContext,
  limit = 100,
  signal?: AbortSignal
) {
  let request = context.db
    .from("conversations")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw databaseError(error);
  return data ?? [];
}

export async function createConversation(context: DbContext, title: string) {
  const { data, error } = await context.db
    .from("conversations")
    .insert({ user_id: context.user.id, title })
    .select()
    .single();
  return requireData(data, error);
}

export async function getConversation(context: DbContext, conversationId: string) {
  const { data, error } = await context.db
    .from("conversations")
    .select("id,title,created_at,updated_at")
    .eq("id", conversationId)
    .maybeSingle();
  return requireData(data, error);
}

export async function updateConversationTitle(context: DbContext, conversationId: string, title: string) {
  const { data, error } = await context.db
    .from("conversations")
    .update({ title })
    .eq("id", conversationId)
    .select()
    .maybeSingle();
  return requireData(data, error);
}

export async function deleteConversation(context: DbContext, conversationId: string): Promise<void> {
  const { data, error } = await context.db
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .select("id")
    .maybeSingle();
  requireData(data, error);
}

export async function listMessages(
  context: DbContext,
  conversationId: string,
  limit = 100,
  signal?: AbortSignal
) {
  await getConversation(context, conversationId);
  let request = context.db
    .from("messages")
    .select("id,conversation_id,role,content,status,metadata,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw databaseError(error);
  return [...(data ?? [])].reverse();
}

export async function createMessage(
  context: DbContext,
  input: {
    conversationId: string;
    role: MessageRole;
    content: string;
    status?: MessageStatus;
    metadata?: Json;
  }
) {
  const { data, error } = await context.db
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      role: input.role,
      content: input.content,
      status: input.status ?? "completed",
      metadata: input.metadata ?? {}
    })
    .select()
    .single();
  return requireData(data, error);
}

export async function updateMessage(
  context: DbContext,
  messageId: string,
  input: { content?: string; status?: MessageStatus; metadata?: Json }
) {
  const { data, error } = await context.db
    .from("messages")
    .update(input)
    .eq("id", messageId)
    .select()
    .maybeSingle();
  return requireData(data, error);
}

export async function listRelevantMemories(
  context: DbContext,
  query: string,
  limit = 6,
  signal?: AbortSignal
) {
  const sanitized = query.replace(/[%_]/g, " ").trim().slice(0, 180);
  let request = context.db
    .from("memories")
    .select("id,category,content,importance,source,metadata,created_at,updated_at")
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (sanitized) {
    request = request.textSearch("content", sanitized, {
      config: "simple",
      type: "plain"
    });
  }
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw databaseError(error);
  return data ?? [];
}

export async function listMemories(context: DbContext, query?: string) {
  return listRelevantMemories(context, query ?? "", 100);
}

export async function createMemory(
  context: DbContext,
  input: {
    category: MemoryCategory;
    content: string;
    importance?: number;
    source?: "user" | "assistant" | "tool" | "import";
    metadata?: Json;
  },
  signal?: AbortSignal
) {
  let request = context.db
    .from("memories")
    .insert({
      user_id: context.user.id,
      category: input.category,
      content: input.content,
      importance: input.importance ?? 3,
      source: input.source ?? "user",
      metadata: input.metadata ?? {}
    })
    .select()
    .single();
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  return requireData(data, error);
}

export async function updateMemory(
  context: DbContext,
  memoryId: string,
  input: {
    category?: MemoryCategory;
    content?: string;
    importance?: number;
    metadata?: Json;
  }
) {
  const { data, error } = await context.db
    .from("memories")
    .update(input)
    .eq("id", memoryId)
    .select()
    .maybeSingle();
  return requireData(data, error);
}

export async function deleteMemory(context: DbContext, memoryId: string): Promise<void> {
  const { data, error } = await context.db
    .from("memories")
    .delete()
    .eq("id", memoryId)
    .select("id")
    .maybeSingle();
  requireData(data, error);
}

export async function getPreferences(context: DbContext) {
  const { data, error } = await context.db
    .from("user_preferences")
    .select("*")
    .eq("user_id", context.user.id)
    .maybeSingle();
  if (error) throw databaseError(error);
  if (data) return data;

  const { data: created, error: createError } = await context.db
    .from("user_preferences")
    .insert({ user_id: context.user.id })
    .select()
    .single();
  return requireData(created, createError);
}

export async function updatePreferences(
  context: DbContext,
  input: {
    language?: string;
    theme?: string;
    tone?: string;
    response_style?: string;
    voice_settings?: Json;
    notifications?: Json;
    privacy_settings?: Json;
  }
) {
  const { data, error } = await context.db
    .from("user_preferences")
    .update(input)
    .eq("user_id", context.user.id)
    .select()
    .maybeSingle();
  return requireData(data, error);
}

export async function getProfile(context: DbContext) {
  const { data, error } = await context.db
    .from("profiles")
    .select("*")
    .eq("id", context.user.id)
    .maybeSingle();
  return requireData(data, error);
}

export async function updateProfile(
  context: DbContext,
  input: { display_name?: string; avatar_url?: string | null; language?: string; timezone?: string }
) {
  const { data, error } = await context.db
    .from("profiles")
    .update(input)
    .eq("id", context.user.id)
    .select()
    .maybeSingle();
  return requireData(data, error);
}

export async function listDevices(context: DbContext) {
  const { data, error } = await context.db
    .from("devices")
    .select("id,user_id,client_id,name,type,platform,status,last_seen,metadata,created_at")
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throw databaseError(error);
  return data ?? [];
}

export async function registerDevice(
  context: DbContext,
  input: {
    clientId: string;
    name: string;
    type: DeviceType;
    platform: string;
    status: "ONLINE" | "OFFLINE" | "CONNECTING" | "ERROR";
    metadata?: Json;
  }
) {
  const existing = await context.db
    .from("devices")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("platform", input.platform)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (existing.error) throw databaseError(existing.error);

  const payload = {
    client_id: input.clientId,
    name: input.name,
    type: input.type,
    platform: input.platform,
    status: input.status,
    last_seen: new Date().toISOString(),
    metadata: input.metadata ?? {}
  };

  if (existing.data) {
    const { data, error } = await context.db
      .from("devices")
      .update(payload)
      .eq("id", existing.data.id)
      .select()
      .single();
    return requireData(data, error);
  }

  const { data, error } = await context.db
    .from("devices")
    .insert({ user_id: context.user.id, ...payload })
    .select()
    .single();
  return requireData(data, error);
}
