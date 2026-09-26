-- Likes and comments on memories. Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.

create table if not exists public.g4u_memory_likes (
  id          uuid primary key default gen_random_uuid(),
  memory_id   uuid not null references public.g4u_memories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (memory_id, user_id)
);

create table if not exists public.g4u_memory_comments (
  id            uuid primary key default gen_random_uuid(),
  memory_id     uuid not null references public.g4u_memories(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  author_name   text check (author_name is null or char_length(author_name) between 1 and 80),
  content       text not null check (char_length(content) between 1 and 500),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists g4u_memory_likes_memory_idx    on public.g4u_memory_likes (memory_id);
create index if not exists g4u_memory_comments_memory_idx on public.g4u_memory_comments (memory_id, created_at) where deleted_at is null;

---------------------------------------------------------------------------
-- RLS: g4u_memory_likes
---------------------------------------------------------------------------
alter table public.g4u_memory_likes enable row level security;

drop policy if exists "g4u likes read via memory" on public.g4u_memory_likes;
drop policy if exists "g4u likes insert own"      on public.g4u_memory_likes;
drop policy if exists "g4u likes delete own"      on public.g4u_memory_likes;
drop policy if exists "g4u likes admin all"       on public.g4u_memory_likes;

-- The subquery runs under the caller's own RLS, so a memory they cannot see contributes no rows —
-- no need to repeat the parent table's status/visibility rules here (same pattern as media).
create policy "g4u likes read via memory" on public.g4u_memory_likes
  for select to anon, authenticated
  using (exists (select 1 from public.g4u_memories m where m.id = memory_id));

create policy "g4u likes insert own" on public.g4u_memory_likes
  for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.g4u_memories m where m.id = memory_id));

create policy "g4u likes delete own" on public.g4u_memory_likes
  for delete to authenticated
  using (auth.uid() = user_id);

create policy "g4u likes admin all" on public.g4u_memory_likes
  for all to authenticated
  using (public.g4u_is_admin()) with check (public.g4u_is_admin());

---------------------------------------------------------------------------
-- RLS: g4u_memory_comments
---------------------------------------------------------------------------
alter table public.g4u_memory_comments enable row level security;

drop policy if exists "g4u comments read via memory" on public.g4u_memory_comments;
drop policy if exists "g4u comments own read"         on public.g4u_memory_comments;
drop policy if exists "g4u comments insert own"       on public.g4u_memory_comments;
drop policy if exists "g4u comments update own"       on public.g4u_memory_comments;
drop policy if exists "g4u comments admin all"        on public.g4u_memory_comments;

create policy "g4u comments read via memory" on public.g4u_memory_comments
  for select to anon, authenticated
  using (deleted_at is null and exists (select 1 from public.g4u_memories m where m.id = memory_id));

-- Must include the author's own soft-deleted rows for the same reason g4u_memories does: an
-- UPDATE (the soft-delete itself) is checked against the SELECT policy on the new row.
create policy "g4u comments own read" on public.g4u_memory_comments
  for select to authenticated
  using (auth.uid() = user_id);

create policy "g4u comments insert own" on public.g4u_memory_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id and deleted_at is null
    and exists (select 1 from public.g4u_memories m where m.id = memory_id)
  );

-- Authors can only edit/soft-delete their own comment's own fields — the check keeps ownership
-- from being reassigned to someone else.
create policy "g4u comments update own" on public.g4u_memory_comments
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "g4u comments admin all" on public.g4u_memory_comments
  for all to authenticated
  using (public.g4u_is_admin()) with check (public.g4u_is_admin());
