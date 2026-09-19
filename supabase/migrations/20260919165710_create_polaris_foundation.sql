-- Polaris IA v0.1 foundation
-- Project: wkaynoafhjtqkhuvknzf
-- This migration intentionally uses relational memory first. Add pgvector only
-- when semantic retrieval is measured as necessary.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Usuario Polaris'
    check (char_length(display_name) between 1 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 2048),
  language text not null default 'es'
    check (language in ('es', 'en')),
  timezone text not null default 'America/Lima'
    check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'es'
    check (language in ('es', 'en')),
  theme text not null default 'dark'
    check (theme in ('dark', 'light', 'system')),
  tone text not null default 'elegante'
    check (char_length(tone) between 1 and 80),
  response_style text not null default 'claro'
    check (char_length(response_style) between 1 and 80),
  voice_settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(voice_settings) = 'object'),
  notifications jsonb not null default '{}'::jsonb
    check (jsonb_typeof(notifications) = 'object'),
  privacy_settings jsonb not null default '{"memory_visible": true}'::jsonb
    check (jsonb_typeof(privacy_settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id text check (client_id is null or char_length(client_id) between 1 and 255),
  name text not null check (char_length(name) between 1 and 120),
  type text not null check (type in ('WEB', 'ANDROID', 'DESKTOP', 'ROBOT')),
  platform text not null check (char_length(platform) between 1 and 120),
  status text not null default 'OFFLINE'
    check (status in ('ONLINE', 'OFFLINE', 'CONNECTING', 'ERROR')),
  last_seen timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nueva conversación'
    check (char_length(title) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null check (char_length(content) <= 100000),
  status text not null default 'completed'
    check (status in ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('PERSONAL', 'PREFERENCE', 'PROJECT', 'CONTEXT', 'FACT', 'GOAL')),
  content text not null check (char_length(content) between 1 and 10000),
  importance smallint not null default 3 check (importance between 1 and 5),
  source text not null default 'user'
    check (source in ('user', 'assistant', 'tool', 'import')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A small, append-only foundation for future tool and device auditability.
-- User-facing clients can read only their own entries; API-only code writes it.
create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  entity_type text check (entity_type is null or char_length(entity_type) <= 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index devices_user_platform_client_id_key
  on public.devices (user_id, platform, client_id)
  where client_id is not null;
create index devices_user_last_seen_idx on public.devices (user_id, last_seen desc);
create index conversations_user_updated_at_idx on public.conversations (user_id, updated_at desc);
create index messages_conversation_created_at_idx on public.messages (conversation_id, created_at asc);
create index memories_user_updated_at_idx on public.memories (user_id, updated_at desc);
create index memories_content_search_idx
  on public.memories using gin (to_tsvector('simple', content));
create index audit_logs_user_created_at_idx on public.audit_logs (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create trigger devices_set_updated_at
before update on public.devices
for each row execute function public.set_updated_at();

create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

create trigger memories_set_updated_at
before update on public.memories
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario Polaris'
    )
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.devices enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.memories enable row level security;
alter table public.audit_logs enable row level security;

-- Explicit Data API grants are separate from RLS. No anon access is granted.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.user_preferences,
  public.devices,
  public.conversations,
  public.messages,
  public.memories
to authenticated;
grant select on table public.audit_logs to authenticated;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "preferences_select_own"
on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "preferences_insert_own"
on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "preferences_update_own"
on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "preferences_delete_own"
on public.user_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "devices_select_own"
on public.devices for select to authenticated
using ((select auth.uid()) = user_id);

create policy "devices_insert_own"
on public.devices for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "devices_update_own"
on public.devices for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "devices_delete_own"
on public.devices for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "conversations_select_own"
on public.conversations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "conversations_insert_own"
on public.conversations for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "conversations_update_own"
on public.conversations for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "conversations_delete_own"
on public.conversations for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "messages_select_own_conversation"
on public.messages for select to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = (select auth.uid())
  )
);

create policy "messages_insert_own_conversation"
on public.messages for insert to authenticated
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = (select auth.uid())
  )
);

create policy "messages_update_own_conversation"
on public.messages for update to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = (select auth.uid())
  )
);

create policy "messages_delete_own_conversation"
on public.messages for delete to authenticated
using (
  exists (
    select 1
    from public.conversations
    where conversations.id = messages.conversation_id
      and conversations.user_id = (select auth.uid())
  )
);

create policy "memories_select_own"
on public.memories for select to authenticated
using ((select auth.uid()) = user_id);

create policy "memories_insert_own"
on public.memories for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "memories_update_own"
on public.memories for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "memories_delete_own"
on public.memories for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "audit_logs_select_own"
on public.audit_logs for select to authenticated
using ((select auth.uid()) = user_id);
