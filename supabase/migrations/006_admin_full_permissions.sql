-- 006_admin_full_permissions.sql
-- Grant full admin control policies over public.profiles and system settings

-- 1. Helper function to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- 2. Drop legacy update policy on profiles if existing
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;

-- 3. Create comprehensive admin policies for public.profiles
CREATE POLICY "profiles_update_admin" ON public.profiles
FOR UPDATE TO authenticated
USING ( public.is_admin() )
WITH CHECK ( true );

CREATE POLICY "profiles_insert_admin" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK ( public.is_admin() OR auth.uid() = id );

CREATE POLICY "profiles_delete_admin" ON public.profiles
FOR DELETE TO authenticated
USING ( public.is_admin() );

-- 4. Create an admin settings table if needed for platform settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_settings_read_all" ON public.admin_settings;
CREATE POLICY "admin_settings_read_all" ON public.admin_settings
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_settings_manage_admin" ON public.admin_settings;
CREATE POLICY "admin_settings_manage_admin" ON public.admin_settings
FOR ALL TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- Insert default admin settings if not existing
INSERT INTO public.admin_settings (key, value)
VALUES 
  ('auto_approve_users', 'false'::jsonb),
  ('require_invite_code', 'false'::jsonb),
  ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
