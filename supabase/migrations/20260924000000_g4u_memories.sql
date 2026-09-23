-- G4U 15 Years: community memories (text + photos + video).
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Prerequisite: Authentication -> Providers -> enable "Allow anonymous sign-ins".
-- The site has no login UI yet, so contributors get an anonymous session, which
-- gives auth.uid() for RLS and for the per-user storage folder.
-- Admins: set app_metadata {"role":"admin"} on the user (Auth -> Users, or
-- via the service role from a trusted place). Never from the browser.

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------
create or replace function public.g4u_is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- "Member" = signed in with a real (non-anonymous) account.
create or replace function public.g4u_is_member() returns boolean
language sql stable as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;

---------------------------------------------------------------------------
-- Tables
---------------------------------------------------------------------------
create table if not exists public.g4u_memories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  -- No profiles table exists in this project, and contributors are anonymous
  -- sessions, so the display name lives here instead of in a duplicate profile.
  author_name   text check (author_name is null or char_length(author_name) between 1 and 80),
  year          integer not null check (year >= 2010 and year <= 2026),
  title         text check (title is null or char_length(title) <= 120),
  content       text check (content is null or char_length(content) <= 4000),
  memory_date   date,
  location      text check (location is null or char_length(location) <= 120),
  visibility    text not null default 'public' check (visibility in ('public', 'members')),
  status        text not null default 'published'
                check (status in ('draft', 'pending', 'published', 'hidden', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create table if not exists public.g4u_memory_media (
  id                uuid primary key default gen_random_uuid(),
  memory_id         uuid not null references public.g4u_memories(id) on delete cascade,
  media_type        text not null check (media_type in ('image', 'video')),
  storage_path      text not null,
  thumbnail_path    text,
  original_filename text,
  mime_type         text,
  file_size         bigint,
  width             integer,
  height            integer,
  duration          numeric,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  unique (memory_id, storage_path)
);

---------------------------------------------------------------------------
-- Indexes
---------------------------------------------------------------------------
create index if not exists g4u_memories_year_idx            on public.g4u_memories (year);
create index if not exists g4u_memories_year_status_idx     on public.g4u_memories (year, status);
create index if not exists g4u_memories_user_idx            on public.g4u_memories (user_id);
create index if not exists g4u_memories_year_status_vis_idx on public.g4u_memories (year, status, visibility);
create index if not exists g4u_memories_feed_idx
  on public.g4u_memories (year, memory_date, created_at) where deleted_at is null;
create index if not exists g4u_memory_media_memory_idx      on public.g4u_memory_media (memory_id);

---------------------------------------------------------------------------
-- Triggers
---------------------------------------------------------------------------
create or replace function public.g4u_memories_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  if tg_op = 'UPDATE' and not public.g4u_is_admin() then
    -- Authors can edit content and soft-delete, but cannot re-publish
    -- something an admin hid, or hand a memory to another user.
    if new.status is distinct from old.status then
      raise exception 'only admins can change memory status';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'memory owner cannot be changed';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists g4u_memories_guard on public.g4u_memories;
create trigger g4u_memories_guard before insert or update on public.g4u_memories
  for each row execute function public.g4u_memories_guard();

-- At most 20 images and 3 videos per memory (also enforced client-side).
create or replace function public.g4u_memory_media_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select count(*) into n from public.g4u_memory_media
   where memory_id = new.memory_id and media_type = new.media_type;
  if new.media_type = 'image' and n >= 20 then
    raise exception 'too many images for this memory';
  elsif new.media_type = 'video' and n >= 3 then
    raise exception 'too many videos for this memory';
  end if;
  return new;
end $$;

drop trigger if exists g4u_memory_media_limits on public.g4u_memory_media;
create trigger g4u_memory_media_limits before insert on public.g4u_memory_media
  for each row execute function public.g4u_memory_media_limits();

---------------------------------------------------------------------------
-- RLS: g4u_memories
---------------------------------------------------------------------------
alter table public.g4u_memories enable row level security;

drop policy if exists "g4u_memories public read"  on public.g4u_memories;
drop policy if exists "g4u_memories member read"  on public.g4u_memories;
drop policy if exists "g4u_memories own read"     on public.g4u_memories;
drop policy if exists "g4u_memories insert own"   on public.g4u_memories;
drop policy if exists "g4u_memories update own"   on public.g4u_memories;
drop policy if exists "g4u_memories admin all"    on public.g4u_memories;

create policy "g4u_memories public read" on public.g4u_memories
  for select to anon, authenticated
  using (deleted_at is null and status = 'published' and visibility = 'public');

create policy "g4u_memories member read" on public.g4u_memories
  for select to authenticated
  using (deleted_at is null and status = 'published'
         and visibility = 'members' and public.g4u_is_member());

-- Must include the author's own soft-deleted rows: Postgres checks SELECT
-- policies against the new row on UPDATE, so hiding them here would make
-- soft-delete fail with an RLS violation. The app filters deleted_at itself.
create policy "g4u_memories own read" on public.g4u_memories
  for select to authenticated
  using (auth.uid() = user_id);

-- MVP: new memories go live immediately; admins hide/reject after the fact.
-- Switch 'published' to 'pending' here to require approval first.
create policy "g4u_memories insert own" on public.g4u_memories
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status in ('published', 'pending')
    and deleted_at is null
    and (visibility = 'public' or public.g4u_is_member())
  );

create policy "g4u_memories update own" on public.g4u_memories
  for update to authenticated
  using (auth.uid() = user_id and deleted_at is null and status in ('draft', 'pending', 'published'))
  with check (auth.uid() = user_id and (visibility = 'public' or public.g4u_is_member()));

create policy "g4u_memories admin all" on public.g4u_memories
  for all to authenticated
  using (public.g4u_is_admin()) with check (public.g4u_is_admin());

---------------------------------------------------------------------------
-- RLS: g4u_memory_media (inherits visibility from the parent memory's RLS)
---------------------------------------------------------------------------
alter table public.g4u_memory_media enable row level security;

drop policy if exists "g4u_media read via memory" on public.g4u_memory_media;
drop policy if exists "g4u_media insert own"      on public.g4u_memory_media;
drop policy if exists "g4u_media update own"      on public.g4u_memory_media;
drop policy if exists "g4u_media delete own"      on public.g4u_memory_media;
drop policy if exists "g4u_media admin all"       on public.g4u_memory_media;

create policy "g4u_media read via memory" on public.g4u_memory_media
  for select to anon, authenticated
  using (exists (select 1 from public.g4u_memories m where m.id = memory_id));

create policy "g4u_media insert own" on public.g4u_memory_media
  for insert to authenticated
  with check (
    exists (select 1 from public.g4u_memories m
             where m.id = memory_id and m.user_id = auth.uid())
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );

create policy "g4u_media update own" on public.g4u_memory_media
  for update to authenticated
  using (exists (select 1 from public.g4u_memories m where m.id = memory_id and m.user_id = auth.uid()))
  with check (split_part(storage_path, '/', 1) = auth.uid()::text);

create policy "g4u_media delete own" on public.g4u_memory_media
  for delete to authenticated
  using (exists (select 1 from public.g4u_memories m where m.id = memory_id and m.user_id = auth.uid()));

create policy "g4u_media admin all" on public.g4u_memory_media
  for all to authenticated
  using (public.g4u_is_admin()) with check (public.g4u_is_admin());

---------------------------------------------------------------------------
-- Storage: private bucket, read via signed URLs
---------------------------------------------------------------------------
-- NOTE: Supabase's free plan caps any single upload at 50 MB regardless of
-- the bucket limit below. For the 200 MB video limit, upgrade the plan and
-- raise Storage -> Settings -> Global file size limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'g4u-memories', 'g4u-memories', false, 209715200,
  array['image/jpeg', 'image/png', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "g4u storage upload own folder" on storage.objects;
drop policy if exists "g4u storage read visible"      on storage.objects;
drop policy if exists "g4u storage delete own"        on storage.objects;

-- Uploads only into "<auth.uid()>/...".
create policy "g4u storage upload own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'g4u-memories'
              and (storage.foldername(name))[1] = auth.uid()::text);

-- A file is readable if it belongs to a memory the caller may see (the
-- subquery runs under the caller's RLS), or it is the caller's own upload.
create policy "g4u storage read visible" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'g4u-memories'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.g4u_is_admin()
      or exists (select 1 from public.g4u_memory_media m
                  where m.storage_path = name or m.thumbnail_path = name)
    )
  );

create policy "g4u storage delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'g4u-memories'
         and (storage.foldername(name))[1] = auth.uid()::text);
