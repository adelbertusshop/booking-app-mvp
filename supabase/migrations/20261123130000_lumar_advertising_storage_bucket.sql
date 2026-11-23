-- LUMAR advertising image storage for isolated Preview and later reviewed rollout.
-- Public read is intentional for approved campaign creatives; uploads remain server-only.
begin;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'lumar-advertising',
  'lumar-advertising',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table storage.buckets is
  'Supabase Storage bucket metadata; lumar-advertising serves approved public campaign creatives.';

commit;
