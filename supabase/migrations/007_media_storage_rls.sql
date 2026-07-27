-- 007_media_storage_rls.sql
-- Fix 403 storage upload failures by defining explicit RLS policies
-- for the `media` bucket used by chat attachments, statuses, and avatars.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read"
on storage.objects
for select
to public
using (bucket_id = 'media');

drop policy if exists "media_auth_insert_scoped" on storage.objects;
create policy "media_auth_insert_scoped"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'media'
  and (
    (
      (storage.foldername(name))[1] = 'chat'
      and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
      and exists (
        select 1
        from public.conversation_members cm
        where cm.conversation_id = ((storage.foldername(name))[2])::uuid
          and cm.user_id = auth.uid()
      )
    )
    or (
      (storage.foldername(name))[1] = 'status'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'avatars'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

drop policy if exists "media_auth_update_scoped" on storage.objects;
create policy "media_auth_update_scoped"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'media'
  and owner = auth.uid()
)
with check (
  bucket_id = 'media'
  and owner = auth.uid()
);

drop policy if exists "media_auth_delete_scoped" on storage.objects;
create policy "media_auth_delete_scoped"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'media'
  and owner = auth.uid()
);