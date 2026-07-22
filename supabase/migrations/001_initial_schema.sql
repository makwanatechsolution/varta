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
  id uuid primary key references auth.users(id) on delete cascade,
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
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
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
  id uuid primary key default uuid_generate_v4(),
  type public.conversation_type not null default 'direct',
  title text,
  description text,
  avatar_url text,
  created_by uuid references public.profiles(id) on delete set null,
  is_archived boolean default false,
  last_message_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.conversation_members (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  type public.message_type not null default 'text',
  content text,
  media_url text,
  gif_url text,
  reply_to_id uuid references public.messages(id) on delete set null,
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
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now() not null,
  unique (message_id, user_id, emoji)
);

-- ============================================================
-- READ RECEIPTS
-- ============================================================
create table public.message_read_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz default now() not null,
  primary key (message_id, user_id)
);

-- ============================================================
-- CALLS (WhatsApp-style 1:1 & group)
-- ============================================================
create type public.call_type as enum ('voice', 'video');
create type public.call_status as enum ('ringing', 'active', 'ended', 'missed', 'declined', 'failed');

create table public.calls (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete set null,
  initiator_id uuid not null references public.profiles(id) on delete cascade,
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
  id uuid primary key default uuid_generate_v4(),
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz,
  left_at timestamptz,
  is_muted boolean default false,
  is_video_off boolean default false,
  unique (call_id, user_id)
);

-- WebRTC signaling payloads (Supabase Realtime channel alternative storage)
create table public.call_signals (
  id uuid primary key default uuid_generate_v4(),
  call_id uuid not null references public.calls(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid references public.profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice-candidate', 'hangup')),
  payload jsonb not null,
  created_at timestamptz default now() not null
);

-- ============================================================
-- MEETINGS (Teams-style scheduled)
-- ============================================================
create type public.meeting_status as enum ('scheduled', 'live', 'ended', 'cancelled');

create table public.meetings (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete set null,
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  duration_minutes int default 60,
  join_link text unique default uuid_generate_v4()::text,
  status public.meeting_status default 'scheduled',
  waiting_room_enabled boolean default true,
  auto_admit boolean default false,
  recording_url text,
  recording_consent_given boolean default false,
  call_id uuid references public.calls(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.meeting_participants (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  status_id uuid not null references public.statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz default now() not null,
  reaction_emoji text,
  primary key (status_id, viewer_id)
);

-- ============================================================
-- PUSH TOKENS (FCM)
-- ============================================================
create table public.push_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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
  user_id uuid not null references public.profiles(id) on delete cascade,
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_read_receipts enable row level security;
alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.statuses enable row level security;
alter table public.status_views enable row level security;
alter table public.push_tokens enable row level security;
alter table public.gif_favorites enable row level security;

-- Profiles: read all authenticated, update own
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Contacts
create policy "contacts_own" on public.contacts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Conversations: members only
create policy "conversations_select" on public.conversations for select to authenticated
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = id and cm.user_id = auth.uid()
  ));

create policy "conversations_insert" on public.conversations for insert to authenticated
  with check (auth.uid() = created_by);

-- Conversation members
create policy "members_select" on public.conversation_members for select to authenticated
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
  ));

create policy "members_insert" on public.conversation_members for insert to authenticated
  with check (auth.uid() = user_id or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id and cm.user_id = auth.uid() and cm.role in ('owner', 'admin')
  ));

-- Messages: conversation members
create policy "messages_select" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
  ));

create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
    )
  );

create policy "messages_update_own" on public.messages for update to authenticated
  using (auth.uid() = sender_id);

-- Reactions
create policy "reactions_select" on public.message_reactions for select to authenticated using (true);
create policy "reactions_manage_own" on public.message_reactions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Read receipts
create policy "receipts_all" on public.message_read_receipts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Calls
create policy "calls_participants" on public.calls for select to authenticated
  using (exists (
    select 1 from public.call_participants cp where cp.call_id = id and cp.user_id = auth.uid()
  ) or auth.uid() = initiator_id);

create policy "calls_insert" on public.calls for insert to authenticated with check (auth.uid() = initiator_id);

create policy "call_participants_all" on public.call_participants for all to authenticated using (true);
create policy "call_signals_participants" on public.call_signals for all to authenticated using (true);

-- Meetings
create policy "meetings_select" on public.meetings for select to authenticated using (true);
create policy "meetings_manage_host" on public.meetings for all to authenticated
  using (auth.uid() = host_id) with check (auth.uid() = host_id);

create policy "meeting_participants_all" on public.meeting_participants for all to authenticated using (true);

-- Statuses
create policy "statuses_select" on public.statuses for select to authenticated
  using (is_deleted = false and expires_at > now());

create policy "statuses_manage_own" on public.statuses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "status_views_all" on public.status_views for all to authenticated using (true);

-- Push tokens
create policy "push_tokens_own" on public.push_tokens for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- GIF favorites
create policy "gif_favorites_own" on public.gif_favorites for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- INVITATIONS (Email Invites & Trackable History)
-- ============================================================
create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  invite_code text unique not null default uuid_generate_v4()::text,
  custom_message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz default now() not null,
  accepted_at timestamptz
);

alter table public.invitations enable row level security;

create policy "invitations_own" on public.invitations for all to authenticated
  using (auth.uid() = inviter_id) with check (auth.uid() = inviter_id);

create policy "invitations_public_read" on public.invitations for select to anon, authenticated
  using (true);

-- ============================================================
-- SOCIAL FEED / POSTS (Facebook & Instagram style)
-- ============================================================
create table public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

create policy "posts_select" on public.posts for select to authenticated using (true);
create policy "posts_manage_own" on public.posts for all to authenticated
  using (auth.uid() = author_id) with check (auth.uid() = author_id);

create policy "post_likes_all" on public.post_likes for all to authenticated using (true);
create policy "post_comments_all" on public.post_comments for all to authenticated using (true);

-- Realtime publication
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.call_signals;
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.invitations;
alter publication supabase_realtime add table public.posts;
