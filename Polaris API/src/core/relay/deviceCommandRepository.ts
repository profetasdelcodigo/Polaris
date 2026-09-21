import type { Json } from "@polaris/contracts";
import type { AuthenticatedContext } from "../../auth.js";
import { PolarisError } from "../../errors.js";

type DbContext = Pick<AuthenticatedContext, "db" | "user">;

export type RelayCommandStatus =
  | "PENDING"
  | "CLAIMED"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface CreateRelayCommandInput {
  targetDeviceId: string;
  sourceDeviceId?: string;
  capabilityId: string;
  action: string;
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  ttlSeconds?: number;
}

export interface UpdateRelayCommandInput {
  status: RelayCommandStatus;
  result?: Record<string, unknown>;
  errorMessage?: string | null;
}

async function ensureOwnedDevice(context: DbContext, deviceId: string) {
  const { data, error } = await context.db
    .from("devices")
    .select("id,user_id,name,type,status,last_seen")
    .eq("id", deviceId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new PolarisError("DATABASE_ERROR", "No se pudo verificar el dispositivo destino.", 503, {
      expose: false,
      cause: error
    });
  }

  if (!data) {
    throw new PolarisError("NOT_FOUND", "El dispositivo destino no pertenece a esta cuenta.", 404);
  }

  return data;
}

export async function createRelayCommand(
  context: DbContext,
  input: CreateRelayCommandInput
) {
  await ensureOwnedDevice(context, input.targetDeviceId);

  if (input.sourceDeviceId) {
    await ensureOwnedDevice(context, input.sourceDeviceId);
  }

  const ttl = Math.min(Math.max(input.ttlSeconds ?? 120, 10), 600);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  const { data, error } = await context.db
    .from("device_commands")
    .insert({
      user_id: context.user.id,
      source_device_id: input.sourceDeviceId ?? null,
      target_device_id: input.targetDeviceId,
      capability_id: input.capabilityId,
      action: input.action,
      payload: (input.payload ?? {}) as Json,
      requires_confirmation: input.requiresConfirmation ?? true,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (error || !data) {
    throw new PolarisError("DATABASE_ERROR", "No se pudo crear la orden entre dispositivos.", 503, {
      expose: false,
      cause: error ?? undefined
    });
  }

  return data;
}

export async function listPendingRelayCommands(
  context: DbContext,
  targetDeviceId: string,
  limit = 20
) {
  await ensureOwnedDevice(context, targetDeviceId);

  const now = new Date().toISOString();

  const { data: expired } = await context.db
    .from("device_commands")
    .update({ status: "EXPIRED", completed_at: now })
    .eq("target_device_id", targetDeviceId)
    .eq("user_id", context.user.id)
    .in("status", ["PENDING", "CLAIMED"])
    .lt("expires_at", now)
    .select("id");

  void expired;

  const { data, error } = await context.db
    .from("device_commands")
    .select("*")
    .eq("target_device_id", targetDeviceId)
    .eq("user_id", context.user.id)
    .eq("status", "PENDING")
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (error) {
    throw new PolarisError("DATABASE_ERROR", "No se pudieron consultar las órdenes pendientes.", 503, {
      expose: false,
      cause: error
    });
  }

  return data ?? [];
}

export async function claimRelayCommand(
  context: DbContext,
  commandId: string,
  targetDeviceId: string
) {
  await ensureOwnedDevice(context, targetDeviceId);

  const now = new Date().toISOString();
  const { data, error } = await context.db
    .from("device_commands")
    .update({
      status: "CLAIMED",
      claimed_at: now
    })
    .eq("id", commandId)
    .eq("user_id", context.user.id)
    .eq("target_device_id", targetDeviceId)
    .eq("status", "PENDING")
    .gt("expires_at", now)
    .select()
    .maybeSingle();

  if (error) {
    throw new PolarisError("DATABASE_ERROR", "No se pudo reclamar la orden.", 503, {
      expose: false,
      cause: error
    });
  }

  if (!data) {
    throw new PolarisError("NOT_FOUND", "La orden ya fue reclamada, cancelada o expiró.", 409);
  }

  return data;
}

export async function updateRelayCommand(
  context: DbContext,
  commandId: string,
  input: UpdateRelayCommandInput
) {
  const now = new Date().toISOString();
  const patch = {
    status: input.status,
    result: (input.result ?? {}) as Json,
    error_message: input.errorMessage ?? null,
    completed_at: ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"].includes(input.status) ? now : null,
    ...(input.status === "RUNNING" ? { claimed_at: now } : {})
  };

  const { data, error } = await context.db
    .from("device_commands")
    .update(patch)
    .eq("id", commandId)
    .eq("user_id", context.user.id)
    .in("status", ["CLAIMED", "RUNNING"])
    .select()
    .maybeSingle();

  if (error) {
    throw new PolarisError("DATABASE_ERROR", "No se pudo actualizar la orden del dispositivo.", 503, {
      expose: false,
      cause: error
    });
  }

  if (!data) {
    throw new PolarisError("NOT_FOUND", "La orden no está disponible para actualización.", 404);
  }

  return data;
}
