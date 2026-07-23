-- 005_ultimate_rls_fix.sql
-- Complete reset of all chat-related RLS policies to guarantee 0 errors.

-- 1. Redefine is_member_of to be absolutely bulletproof
CREATE OR REPLACE FUNCTION public.is_member_of(conv_id uuid)
RETURNS boolean
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$$;

-- 2. Drop all policies on chat tables to start fresh
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_insert" ON public.conversations;

DROP POLICY IF EXISTS "members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "members_insert" ON public.conversation_members;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;

-- 3. Conversations Table
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
USING ( public.is_member_of(id) OR created_by = auth.uid() );

CREATE POLICY "conversations_insert" ON public.conversations FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = created_by );

-- 4. Conversation Members Table
-- Allow selecting all members if you are a member of that conversation
CREATE POLICY "members_select" ON public.conversation_members FOR SELECT TO authenticated
USING ( public.is_member_of(conversation_id) OR user_id = auth.uid() );

-- Allow inserting if you are inserting yourself, or if you are already an owner/admin of that conversation
CREATE POLICY "members_insert" ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK ( 
  auth.uid() = user_id OR 
  (
    public.is_member_of(conversation_id) AND 
    EXISTS (
      SELECT 1 FROM public.conversation_members 
      WHERE conversation_id = public.conversation_members.conversation_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  )
);

-- 5. Messages Table
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
USING ( public.is_member_of(conversation_id) );

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = sender_id AND public.is_member_of(conversation_id) );

CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE TO authenticated
USING ( auth.uid() = sender_id );
