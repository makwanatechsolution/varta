-- Fix ambiguous column references in RLS policies that cause 500 Internal Server Errors
-- Run this in your Supabase SQL Editor

-- 1. Fix Messages Insert Policy
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND conversation_id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
    )
  );

-- 2. Fix Messages Select Policy
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
    )
  );

-- 3. Fix Conversation Members Insert Policy
DROP POLICY IF EXISTS "members_insert" ON public.conversation_members;
CREATE POLICY "members_insert" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR conversation_id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ) OR conversation_id IN (
      SELECT id FROM public.conversations WHERE created_by = auth.uid()
    )
  );

-- 4. Fix Conversations Select Policy
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR id IN (
      SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
    )
  );

-- 5. Make the Trigger Crash-Proof
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors so the message still sends!
  RETURN NEW;
END;
$$;
