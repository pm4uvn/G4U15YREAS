-- Patch for databases that already ran 20260924000000: lets authors soft-delete.
drop policy if exists "g4u_memories own read" on public.g4u_memories;
create policy "g4u_memories own read" on public.g4u_memories
  for select to authenticated
  using (auth.uid() = user_id);

-- Remove the row left behind by the automated end-to-end test.
delete from public.g4u_memories where title = '[TEST] delete me' and author_name = 'TEST';
