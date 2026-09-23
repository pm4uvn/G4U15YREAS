-- Voice notes: a memory can carry short audio recordings (recorded in the browser). Safe to re-run.

-- Replace the media-type constraints (drops every check that mentions media_type, then re-adds them).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.g4u_memory_media'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) like '%media_type%'
  loop
    execute format('alter table public.g4u_memory_media drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.g4u_memory_media add constraint g4u_memory_media_media_type_check
  check (media_type in ('image', 'video', 'audio'));

alter table public.g4u_memory_media add constraint g4u_memory_media_kind_check check (
  (media_type in ('image', 'audio') and storage_path is not null and provider is null and external_id is null)
  or
  (media_type = 'video' and storage_path is null and provider = 'youtube'
     and external_id ~ '^[A-Za-z0-9_-]{11}$')
);

-- Recordings are short: at most 5 minutes each.
alter table public.g4u_memory_media drop constraint if exists g4u_memory_media_audio_duration_check;
alter table public.g4u_memory_media add constraint g4u_memory_media_audio_duration_check
  check (media_type <> 'audio' or (duration is not null and duration > 0 and duration <= 300));

-- Per-memory limits: 20 images, 3 videos, 3 voice notes.
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
  elsif new.media_type = 'audio' and n >= 3 then
    raise exception 'too many voice notes for this memory';
  end if;
  return new;
end $$;

-- The bucket now also accepts the audio containers browsers record (Chrome/Firefox: webm/ogg, Safari: mp4).
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a'
       ]
 where id = 'g4u-memories';
