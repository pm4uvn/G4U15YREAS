-- Grants the admin role to a second account (login "Admin" -> email admin@admin.com).
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- Supabase requires a real email *shape* to sign in (something@something), so a bare "admin"
-- can't be used as-is — this is the closest fake stand-in for it.
--
-- Before running: Authentication -> Users -> Add user
--   email: admin@admin.com
--   password: g4u15years
--   tick "Auto Confirm User"
-- After running: sign out and back in on /admin so the role is in the session token.

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
 where email = 'admin@admin.com';
