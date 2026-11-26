create table public.pending_staff_password (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.pending_staff_password enable row level security;
revoke all on public.pending_staff_password from public, anon, authenticated;

create function public.track_invited_staff_password() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.invited_at is null then return new; end if;
  if tg_op = 'INSERT' or old.invited_at is null then
    insert into public.pending_staff_password values (new.id) on conflict do nothing;
  elsif old.email_confirmed_at is not null and new.encrypted_password is distinct from old.encrypted_password then
    delete from public.pending_staff_password where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.track_invited_staff_password() from public, anon, authenticated;
create trigger track_invited_staff_password after insert or update of invited_at, encrypted_password on auth.users
  for each row execute function public.track_invited_staff_password();

create or replace function public.get_staff_access()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with staff as (
    select r.role
    from public.staff_roles r
    join auth.users u on u.id = r.user_id
    where r.user_id = (select auth.uid())
      and not exists (select 1 from public.pending_staff_password p where p.user_id = u.id)
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
