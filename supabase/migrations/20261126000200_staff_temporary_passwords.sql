create or replace function public.get_staff_access()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with staff as (
    select r.role
    from public.staff_roles r
    join auth.users u on u.id = r.user_id
    where r.user_id = (select auth.uid())
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

create function public.clear_temporary_password() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.raw_app_meta_data->'temporary_password' = 'true'::jsonb
    and new.encrypted_password is distinct from old.encrypted_password
    and new.encrypted_password is not null and new.encrypted_password <> '' then
    new.raw_app_meta_data := new.raw_app_meta_data - 'temporary_password';
  end if;
  return new;
end;
$$;
revoke all on function public.clear_temporary_password() from public, anon, authenticated;
create trigger clear_temporary_password before update of encrypted_password on auth.users
  for each row execute function public.clear_temporary_password();

create or replace function public.update_staff_role(target_email text, target_role public.staff_role, enabled boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  target_id uuid;
begin
  perform pg_advisory_xact_lock(20261121, 1);
  if not public.has_permission('settings.write') then
    raise exception 'Staff access administration denied' using errcode = '42501';
  end if;

  select id into target_id from auth.users
    where lower(email) = lower(btrim(target_email)) and deleted_at is null;
  if not found then return 'account_missing'; end if;

  if enabled then
    insert into public.staff_roles (user_id, role) values (target_id, target_role)
      on conflict do nothing;
  else
    if target_role = 'admin' and not exists (
      select 1 from public.staff_roles r
      join auth.users u on u.id = r.user_id
      where r.role = 'admin' and r.user_id <> target_id and u.deleted_at is null
        and (u.banned_until is null or u.banned_until <= now()) and u.email_confirmed_at is not null
        and u.raw_app_meta_data->'temporary_password' is distinct from 'true'::jsonb
    ) then
      return 'last_administrator';
    end if;
    delete from public.staff_roles where user_id = target_id and role = target_role;
  end if;
  return 'saved';
end;
$$;
