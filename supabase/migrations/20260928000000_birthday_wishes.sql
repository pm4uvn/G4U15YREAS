-- Birthday wishes for the club's 15th anniversary, shown scrolling on the cover.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.

create table if not exists public.g4u_birthday_wishes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  author_name   text check (author_name is null or char_length(author_name) between 1 and 80),
  message       text not null check (char_length(message) between 1 and 300),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists g4u_birthday_wishes_feed_idx on public.g4u_birthday_wishes (created_at desc) where deleted_at is null;

alter table public.g4u_birthday_wishes enable row level security;

drop policy if exists "g4u wishes public read" on public.g4u_birthday_wishes;
drop policy if exists "g4u wishes own read"    on public.g4u_birthday_wishes;
drop policy if exists "g4u wishes insert own"  on public.g4u_birthday_wishes;
drop policy if exists "g4u wishes update own"  on public.g4u_birthday_wishes;
drop policy if exists "g4u wishes admin all"   on public.g4u_birthday_wishes;

create policy "g4u wishes public read" on public.g4u_birthday_wishes
  for select to anon, authenticated
  using (deleted_at is null);

-- Must include the author's own soft-deleted rows for the same reason g4u_memories does: an
-- UPDATE (the soft-delete itself) is checked against the SELECT policy on the new row.
create policy "g4u wishes own read" on public.g4u_birthday_wishes
  for select to authenticated
  using (auth.uid() = user_id);

create policy "g4u wishes insert own" on public.g4u_birthday_wishes
  for insert to authenticated
  with check (auth.uid() = user_id and deleted_at is null);

create policy "g4u wishes update own" on public.g4u_birthday_wishes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "g4u wishes admin all" on public.g4u_birthday_wishes
  for all to authenticated
  using (public.g4u_is_admin()) with check (public.g4u_is_admin());
