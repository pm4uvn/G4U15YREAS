-- Admin can add media to any member's memory from the admin edit screen (/admin). Run once in
-- Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- The upload policy only ever let authors write into their own "<auth.uid()>/..." folder. The admin
-- edit screen adds photos/voice notes/videos into the memory's EXISTING owner/id folder (keeping
-- storage paths consistent with that memory's other files), which the admin's own uid doesn't match
-- — so without this, every admin-added file would be rejected by storage RLS.
drop policy if exists "g4u storage admin upload" on storage.objects;
create policy "g4u storage admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'g4u-memories' and public.g4u_is_admin());
