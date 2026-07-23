-- 004_fix_infinite_recursion.sql
-- This absolutely fixes the 500 Internal Server Errors caused by RLS infinite recursion!

-- 1. Create a secure, bypass-RLS function to check membership
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

-- 2. Drop the broken recursive policies
DROP POLICY IF EXISTS "members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;

-- 3. Create non-recursive, fast policies using the helper function
CREATE POLICY "members_select" ON public.conversation_members FOR SELECT TO authenticated
USING ( public.is_member_of(conversation_id) );

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
USING ( public.is_member_of(conversation_id) );

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = sender_id AND public.is_member_of(conversation_id) );

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
USING ( public.is_member_of(id) OR created_by = auth.uid() );
