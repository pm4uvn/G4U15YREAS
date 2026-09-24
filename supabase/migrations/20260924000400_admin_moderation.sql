-- Admin moderation page (/admin). Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Before running: Authentication -> Users -> Add user (sanghm.pm@gmail.com + a password, tick "Auto Confirm").
-- After running: sign out and back in on /admin so the role is in the session token.

-- The role g4u_is_admin() checks. It lives in app_metadata, which the browser cannot change.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'sanghm.pm@gmail.com';

-- The tables already grant admins full access ("admin all" policies). Storage only let authors
-- delete their own folder, so admins need a delete policy to remove members' files.
drop policy if exists "g4u storage admin delete" on storage.objects;
create policy "g4u storage admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'g4u-memories' and public.g4u_is_admin());
