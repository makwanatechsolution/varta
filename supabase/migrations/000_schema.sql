-- Varta: Unified PostgreSQL Schema (Idempotent / Safe for multiple runs)

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUM TYPES (Idempotent)
-- ============================================================
do $$ begin
  create type public.presence_status as enum ('online', 'away', 'busy', 'dnd', 'offline');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.privacy_level as enum ('everyone', 'contacts', 'close_friends', 'nobody');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.conversation_type as enum ('direct', 'group', 'channel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_type as enum ('text', 'image', 'video', 'audio', 'file', 'gif', 'system', 'call_log');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.call_type as enum ('voice', 'video');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.meeting_status as enum ('scheduled', 'live', 'ended', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_media_type as enum ('photo', 'video', 'text');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- PROFILES & PRESENCE
-- ============================================================
create table if not exists public.profiles (
  id text primary key,
  username text unique,
  display_name text not null default '',
  avatar_url text,
  bio text default '',
  phone text,
  last_seen timestamptz default now(),
  presence public.presence_status default 'offline',
  custom_status text,
  custom_status_expires_at timestamptz,
  status_privacy public.privacy_level default 'contacts',
  is_approved boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles
  add column if not exists is_approved boolean default true,
  add column if not exists is_admin boolean default false;

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists public.contacts (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  contact_id text not null references public.profiles(id) on delete cascade,
  nickname text,
  is_close_friend boolean default false,
  created_at timestamptz default now() not null,
  unique (user_id, contact_id),
  check (user_id <> contact_id)
);

-- ============================================================
-- CONVERSATIONS (DM, group, channel)
-- ============================================================
create table if not exists public.conversations (
  id text primary key default gen_random_uuid()::text,
  type public.conversation_type not null default 'direct',
  title text,
  description text,
  avatar_url text,
  created_by text references public.profiles(id) on delete set null,
  is_archived boolean default false,
  last_message_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.conversation_members (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now() not null,
  last_read_at timestamptz,
  muted_until timestamptz,
  unique (conversation_id, user_id)
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_id text references public.profiles(id) on delete set null,
  type public.message_type not null default 'text',
  content text,
  media_url text,
  gif_url text,
  reply_to_id text references public.messages(id) on delete set null,
  is_edited boolean default false,
  is_deleted boolean default false,
  is_starred boolean default false,
  is_pinned boolean default false,
  forwarded_from_id text references public.messages(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_starred_idx on public.messages (conversation_id, is_starred) where is_starred = true;
create index if not exists messages_pinned_idx on public.messages (conversation_id, is_pinned) where is_pinned = true;

-- ============================================================
-- REACTIONS
-- ============================================================
create table if not exists public.message_reactions (
  id text primary key default gen_random_uuid()::text,
  message_id text not null references public.messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now() not null,
  unique (message_id, user_id, emoji)
);

-- ============================================================
-- READ RECEIPTS
-- ============================================================
create table if not exists public.message_read_receipts (
  message_id text not null references public.messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  read_at timestamptz default now() not null,
  primary key (message_id, user_id)
);

-- ============================================================
-- CALLS
-- ============================================================
create table if not exists public.calls (
  id text primary key default gen_random_uuid()::text,
  conversation_id text references public.conversations(id) on delete set null,
  initiator_id text not null references public.profiles(id) on delete cascade,
  type public.call_type not null default 'voice',
  status public.call_status not null default 'ringing',
  started_at timestamptz default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  quality_score numeric(3,2),
  created_at timestamptz default now() not null
);

create table if not exists public.call_participants (
  id text primary key default gen_random_uuid()::text,
  call_id text not null references public.calls(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  is_muted boolean default false,
  is_video_off boolean default false,
  unique (call_id, user_id)
);

create table if not exists public.call_signals (
  id text primary key default gen_random_uuid()::text,
  call_id text not null references public.calls(id) on delete cascade,
  from_user_id text not null references public.profiles(id) on delete cascade,
  to_user_id text references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice-candidate', 'hangup')),
  payload jsonb not null,
  created_at timestamptz default now() not null
);

-- ============================================================
-- MEETINGS
-- ============================================================
create table if not exists public.meetings (
  id text primary key default gen_random_uuid()::text,
  conversation_id text references public.conversations(id) on delete set null,
  host_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  duration_minutes int default 60,
  join_link text unique default gen_random_uuid()::text::text,
  status public.meeting_status default 'scheduled',
  waiting_room_enabled boolean default true,
  auto_admit boolean default false,
  recording_url text,
  recording_consent_given boolean default false,
  call_id text references public.calls(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.meeting_participants (
  id text primary key default gen_random_uuid()::text,
  meeting_id text not null references public.meetings(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  rsvp text default 'pending' check (rsvp in ('pending', 'accepted', 'declined')),
  admitted_at timestamptz,
  raised_hand_at timestamptz,
  unique (meeting_id, user_id)
);

-- ============================================================
-- STATUS / STORIES
-- ============================================================
create table if not exists public.statuses (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  media_type public.status_media_type not null default 'photo',
  media_url text,
  text_content text,
  background_color text default '#6366f1',
  visibility public.privacy_level default 'contacts',
  expires_at timestamptz default (now() + interval '24 hours'),
  is_deleted boolean default false,
  created_at timestamptz default now() not null
);

create index if not exists statuses_user_expires_idx on public.statuses (user_id, expires_at desc)
  where is_deleted = false;

create table if not exists public.status_views (
  status_id text not null references public.statuses(id) on delete cascade,
  viewer_id text not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now() not null,
  reaction_emoji text,
  primary key (status_id, viewer_id)
);

-- ============================================================
-- PUSH TOKENS (FCM)
-- ============================================================
create table if not exists public.push_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text check (platform in ('web', 'android', 'ios')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, token)
);

-- ============================================================
-- GIF FAVORITES
-- ============================================================
create table if not exists public.gif_favorites (
  user_id text not null references public.profiles(id) on delete cascade,
  gif_url text not null,
  provider text check (provider in ('tenor', 'giphy')),
  used_count int default 1,
  last_used_at timestamptz default now(),
  primary key (user_id, gif_url)
);

-- ============================================================
-- INVITATIONS
-- ============================================================
create table if not exists public.invitations (
  id text primary key default gen_random_uuid()::text,
  inviter_id text not null references public.profiles(id) on delete cascade,
  email text not null,
  invite_code text unique not null default gen_random_uuid()::text::text,
  custom_message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz default now() not null,
  accepted_at timestamptz
);

-- ============================================================
-- SOCIAL FEED / POSTS
-- ============================================================
create table if not exists public.posts (
  id text primary key default gen_random_uuid()::text,
  author_id text not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.post_likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now() not null
);

-- ============================================================
-- ADMIN SETTINGS
-- ============================================================
create table if not exists public.admin_settings (
  id text primary key default 'singleton',
  auto_approve_users boolean default true,
  require_invite_code boolean default false,
  maintenance_mode boolean default false,
  updated_at timestamptz default now() not null
);

insert into public.admin_settings (id, auto_approve_users, require_invite_code, maintenance_mode)
values ('singleton', true, false, false)
on conflict (id) do nothing;

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute function public.update_conversation_last_message();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
