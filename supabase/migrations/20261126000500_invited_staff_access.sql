drop trigger mark_invitation_password_pending on auth.users;
drop function public.mark_invitation_password_pending();

create or replace function public.get_staff_access()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with staff as (
    select r.role
    from public.staff_roles r
    join auth.users u on u.id = r.user_id
    where r.user_id = (select auth.uid())
      and (u.invited_at is null or coalesce(u.encrypted_password, '') <> '')
      and u.raw_app_meta_data->'temporary_password' is distinct from 'true'::jsonb
      and (select auth.jwt())->'app_metadata'->'temporary_password' is distinct from 'true'::jsonb
  ),
  allowed as (
    select distinct unnest(case staff.role
      when 'admin' then array['personnel.read', 'personnel.write', 'files.read', 'files.write',
                               'inventory.read', 'inventory.write', 'settings.read', 'settings.write', 'audit.read', 'calendar.write']
      when 'school_head' then array['personnel.read', 'files.read', 'inventory.read', 'settings.read', 'audit.read', 'calendar.write']
      when 'administrative_officer' then array['personnel.read', 'personnel.write', 'files.read',
                                                'files.write', 'inventory.read', 'settings.read', 'calendar.write']
      when 'property_custodian' then array['inventory.read', 'inventory.write', 'settings.read', 'calendar.write']
      when 'auditor' then array['personnel.read', 'inventory.read', 'settings.read', 'audit.read']
    end) as permission
    from staff
    union
    select 'calendar.read' from staff
  )
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(role order by role) from staff), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(permission order by permission) from allowed), '[]'::jsonb)
  );
$$;
