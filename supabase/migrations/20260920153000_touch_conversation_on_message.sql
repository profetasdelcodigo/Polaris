create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation_updated_at on public.messages;

create trigger messages_touch_conversation_updated_at
after insert or update of content, status
on public.messages
for each row
execute function public.touch_conversation_updated_at();
