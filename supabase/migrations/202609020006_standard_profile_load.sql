-- Service-only profile read used by the Standard Edge setup boundary.
-- This keeps browser access owner-scoped while avoiding direct table grants.

create or replace function public.fcg_standard_server_load_profile(p_user_id uuid)
returns table (
  revision bigint,
  profile_state jsonb
)
language sql
security definer
set search_path = ''
as $$
  select profile.revision, profile.profile_state
  from public.fcg_standard_profiles profile
  where profile.user_id = p_user_id;
$$;

revoke all on function public.fcg_standard_server_load_profile(uuid)
  from public, anon, authenticated;
grant execute on function public.fcg_standard_server_load_profile(uuid)
  to service_role;
