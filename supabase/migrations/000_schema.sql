-- Varta: Instagram + WhatsApp + Telegram unified schema
-- Run in Supabase SQL Editor. Enable RLS on every table before going live.

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES & PRESENCE
-- ============================================================
create type public.presence_status as enum ('online', 'away', 'busy', 'dnd', 'offline');
create type public.privacy_level as enum ('everyone', 'contacts', 'close_friends', 'nobody');

create table public.profiles (
  id text primary key  on delete cascade,
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================================
-- CONTACTS
-- ============================================================
create table public.contacts (
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
-- CONVERSATIONS (DM, group, channel — Telegram-style)
-- ============================================================
create type public.conversation_type as enum ('direct', 'group', 'channel');

create table public.conversations (
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

create table public.conversation_members (
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
-- MESSAGES (WhatsApp/Telegram-style)
-- ============================================================
create type public.message_type as enum ('text', 'image', 'video', 'audio', 'file', 'gif', 'system', 'call_log');

create table public.messages (
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
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);

-- ============================================================
-- REACTIONS (Level 0–3)
-- ============================================================
create table public.message_reactions (
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
create table public.message_read_receipts (
  message_id text not null references public.messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  read_at timestamptz default now() not null,
  primary key (message_id, user_id)
);

-- ============================================================
-- CALLS (WhatsApp-style 1:1 & group)
-- ============================================================
create type public.call_type as enum ('voice', 'video');
create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined', 'failed');

create table public.calls (
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

create table public.call_participants (
  id text primary key default gen_random_uuid()::text,
  call_id text not null references public.calls(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  is_muted boolean default false,
  is_video_off boolean default false,
  unique (call_id, user_id)
);

-- WebRTC signaling payloads (Supabase Realtime channel alternative storage)
create table public.call_signals (
  id text primary key default gen_random_uuid()::text,
  call_id text not null references public.calls(id) on delete cascade,
  from_user_id text not null references public.profiles(id) on delete cascade,
  to_user_id text references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice-candidate', 'hangup')),
  payload jsonb not null,
  created_at timestamptz default now() not null
);

-- ============================================================
-- MEETINGS (Teams-style scheduled)
-- ============================================================
create type public.meeting_status as enum ('scheduled', 'live', 'ended', 'cancelled');

create table public.meetings (
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

create table public.meeting_participants (
  id text primary key default gen_random_uuid()::text,
  meeting_id text not null references public.meetings(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  rsvp text default 'pending' check (rsvp in ('pending', 'accepted', 'declined')),
  admitted_at timestamptz,
  raised_hand_at timestamptz,
  unique (meeting_id, user_id)
);

-- ============================================================
-- STATUS / STORIES (Instagram-style 24h)
-- ============================================================
create type public.status_media_type as enum ('photo', 'video', 'text');

create table public.statuses (
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

create index statuses_user_expires_idx on public.statuses (user_id, expires_at desc)
  where is_deleted = false;

create table public.status_views (
  status_id text not null references public.statuses(id) on delete cascade,
  viewer_id text not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now() not null,
  reaction_emoji text,
  primary key (status_id, viewer_id)
);

-- ============================================================
-- PUSH TOKENS (FCM)
-- ============================================================
create table public.push_tokens (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text check (platform in ('web', 'android', 'ios')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, token)
);

-- ============================================================
-- GIF SEARCH CACHE (optional server-side dedup)
-- ============================================================
create table public.gif_favorites (
  user_id text not null references public.profiles(id) on delete cascade,
  gif_url text not null,
  provider text check (provider in ('tenor', 'giphy')),
  used_count int default 1,
  last_used_at timestamptz default now(),
  primary key (user_id, gif_url)
);

-- ============================================================
-- TRIGGERS
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;



create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
  set last_message_at = new.created_at, updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

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

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

















-- Profiles: read all authenticated, update own



-- Contacts


-- Conversations: members only




-- Conversation members




-- Messages: conversation members






-- Reactions



-- Read receipts


-- Calls







-- Meetings





-- Statuses






-- Push tokens


-- GIF favorites


-- ============================================================
-- INVITATIONS (Email Invites & Trackable History)
-- ============================================================
create table public.invitations (
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
-- SOCIAL FEED / POSTS (Facebook & Instagram style)
-- ============================================================
create table public.posts (
  id text primary key default gen_random_uuid()::text,
  author_id text not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.post_likes (
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);

create table public.post_comments (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now() not null
);











-- Realtime publication


-- Admin Approval Workflow
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;


-- Feature additions
alter table public.messages
  add column if not exists is_starred boolean default false,
  add column if not exists is_pinned boolean default false,
  add column if not exists forwarded_from_id text references public.messages(id) on delete set null;

create index if not exists messages_starred_idx
  on public.messages (conversation_id, is_starred)
  where is_starred = true;

create index if not exists messages_pinned_idx
  on public.messages (conversation_id, is_pinned)
  where is_pinned = true;


CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS \$\$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
\$\$;
