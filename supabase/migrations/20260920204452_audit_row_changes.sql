create or replace function public.audit_polaris_row_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_user uuid;
  target_id uuid;
begin
  target_user := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  target_id := case
    when tg_op = 'DELETE' then old.id
    else new.id
  end;

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_user,
    lower(tg_op),
    tg_table_name,
    target_id,
    jsonb_build_object('source', 'database_trigger')
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.audit_polaris_row_change() from public;
revoke all on function public.audit_polaris_row_change() from authenticated;
revoke all on function public.audit_polaris_row_change() from anon;

drop trigger if exists audit_memories_changes on public.memories;
create trigger audit_memories_changes
after insert or update or delete on public.memories
for each row execute function public.audit_polaris_row_change();

drop trigger if exists audit_devices_changes on public.devices;
create trigger audit_devices_changes
after insert or update or delete on public.devices
for each row execute function public.audit_polaris_row_change();

drop trigger if exists audit_conversations_changes on public.conversations;
create trigger audit_conversations_changes
after insert or update or delete on public.conversations
for each row execute function public.audit_polaris_row_change();
