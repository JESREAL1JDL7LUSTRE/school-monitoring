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

  if target_id <> (select auth.uid()) and exists (
    select 1 from public.staff_roles where user_id = target_id and role = 'admin'
  ) then
    return 'protected_administrator';
  end if;

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
