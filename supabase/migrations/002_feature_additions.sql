-- ============================================================
-- MIGRATION 002: Feature additions
-- WhatsApp: starred & pinned messages, forward
-- Run in Supabase SQL Editor
-- ============================================================

-- Add starred / pinned / forwarded to messages
alter table public.messages
  add column if not exists is_starred boolean default false,
  add column if not exists is_pinned boolean default false,
  add column if not exists forwarded_from_id uuid references public.messages(id) on delete set null;

-- Index for starred messages per user (we filter by sender_id + is_starred)
create index if not exists messages_starred_idx
  on public.messages (conversation_id, is_starred)
  where is_starred = true;

create index if not exists messages_pinned_idx
  on public.messages (conversation_id, is_pinned)
  where is_pinned = true;

-- Realtime: add statuses table to publication if not already there
alter publication supabase_realtime add table public.statuses;
alter publication supabase_realtime add table public.status_views;
alter publication supabase_realtime add table public.meetings;
alter publication supabase_realtime add table public.meeting_participants;

-- Allow users to star any message in conversations they belong to
-- (messages_update_own only allows sender; we need a separate policy)
create policy "messages_star_any" on public.messages for update to authenticated
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
  ));

-- Allow admins/owners to pin messages
create policy "messages_pin" on public.messages for update to authenticated
  using (exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin', 'member')
  ));
