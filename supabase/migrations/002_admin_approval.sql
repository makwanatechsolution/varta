-- Migration: Admin Approval Workflow

-- 1. Add approval and admin flags to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2. Add an RLS policy allowing admins to update other profiles (for approval)
-- Note: profiles_select is unconditional (true), so this subquery won't infinitely recurse.
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
FOR UPDATE TO authenticated
USING (
  (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true
);

-- 3. Utility Function: make a user admin and approve them
-- (Run this manually in Supabase SQL Editor with your email)
-- Example usage: SELECT make_admin('yash.makwana.b@gmail.com');
CREATE OR REPLACE FUNCTION public.make_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = user_email;
  
  IF target_id IS NOT NULL THEN
    UPDATE public.profiles
    SET is_admin = true, is_approved = true
    WHERE id = target_id;
  END IF;
END;
$$;

-- Automatically make the creator an admin and approve them
SELECT public.make_admin('yash.makwana.b@gmail.com');
