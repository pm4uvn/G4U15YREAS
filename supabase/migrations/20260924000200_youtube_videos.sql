-- Videos are YouTube links, not uploaded files. Run once in SQL Editor. Safe to re-run.

-- A video row has no storage object, so storage_path becomes optional.
alter table public.g4u_memory_media alter column storage_path drop not null;
alter table public.g4u_memory_media add column if not exists provider text;
alter table public.g4u_memory_media add column if not exists external_id text;

alter table public.g4u_memory_media drop constraint if exists g4u_memory_media_kind_check;
alter table public.g4u_memory_media add constraint g4u_memory_media_kind_check check (
  (media_type = 'image' and storage_path is not null and provider is null and external_id is null)
  or
  (media_type = 'video' and storage_path is null and provider = 'youtube'
     and external_id ~ '^[A-Za-z0-9_-]{11}$')
);

-- Same ownership rule as before, but only for rows that actually reference a file.
drop policy if exists "g4u_media insert own" on public.g4u_memory_media;
create policy "g4u_media insert own" on public.g4u_memory_media
  for insert to authenticated
  with check (
    exists (select 1 from public.g4u_memories m
             where m.id = memory_id and m.user_id = auth.uid())
    and (storage_path is null or split_part(storage_path, '/', 1) = auth.uid()::text)
  );

drop policy if exists "g4u_media update own" on public.g4u_memory_media;
create policy "g4u_media update own" on public.g4u_memory_media
  for update to authenticated
  using (exists (select 1 from public.g4u_memories m where m.id = memory_id and m.user_id = auth.uid()))
  with check (storage_path is null or split_part(storage_path, '/', 1) = auth.uid()::text);

-- The bucket now only ever holds images.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'g4u-memories';
