drop trigger if exists audit_devices_changes on public.devices;
create trigger audit_devices_changes
after insert or delete on public.devices
for each row execute function public.audit_polaris_row_change();

drop trigger if exists audit_conversations_changes on public.conversations;
create trigger audit_conversations_changes
after insert or delete on public.conversations
for each row execute function public.audit_polaris_row_change();
