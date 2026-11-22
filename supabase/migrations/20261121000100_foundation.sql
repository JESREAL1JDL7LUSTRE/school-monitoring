create type public.staff_role as enum (
  'admin', 'school_head', 'administrative_officer', 'property_custodian', 'auditor'
);

create table public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function public.get_staff_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with staff as (
    select r.role
    from public.staff_roles r
    where r.user_id = (select auth.uid())
  ),
  allowed as (
    select distinct unnest(case staff.role
      when 'admin' then array['personnel.read', 'personnel.write', 'files.read', 'files.write',
                               'inventory.read', 'inventory.write', 'settings.read', 'settings.write', 'audit.read']
      when 'school_head' then array['personnel.read', 'files.read', 'inventory.read', 'settings.read', 'audit.read']
      when 'administrative_officer' then array['personnel.read', 'personnel.write', 'files.read',
                                                'files.write', 'inventory.read', 'settings.read']
      when 'property_custodian' then array['inventory.read', 'inventory.write', 'settings.read']
      when 'auditor' then array['personnel.read', 'inventory.read', 'settings.read', 'audit.read']
    end) as permission
    from staff
  )
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(role order by role) from staff), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(permission order by permission) from allowed), '[]'::jsonb)
  );
$$;

create function public.has_permission(permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (public.get_staff_access()->'permissions') ? permission;
$$;

revoke all on function public.get_staff_access() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.get_staff_access() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon, authenticated;
grant select on public.staff_roles to authenticated;
create policy staff_roles_own on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()));

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_recent_idx on public.audit_logs (created_at desc, id desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
create policy audit_log_read on public.audit_logs for select to authenticated
  using ((select public.has_permission('audit.read')));

create function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_record jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  entity jsonb := coalesce(new_record, old_record);
  sensitive_keys text[] := array[
    'storage_path', 'object_path', 'file_path', 'file_name', 'original_name', 'filename', 'logo_path',
    'rendered_html', 'html', 'snapshot', 'snapshot_data', 'template_path', 'request_payload',
    'password', 'encrypted_password', 'token', 'access_token', 'refresh_token'
  ];
begin
  if tg_op = 'UPDATE' and old_record is not distinct from new_record then
    return null;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
  values (
    auth.uid(), tg_op, tg_table_name,
    coalesce(entity->>'id',
      case when tg_table_name = 'staff_roles' then concat(entity->>'user_id', '/', entity->>'role') end,
      case when entity ? 'employee_id' and entity ? 'document_type_id'
        then concat(entity->>'employee_id', '/', entity->>'document_type_id') end,
      entity->>'employee_id', entity->>'user_id', entity->>'item_id'),
    old_record - sensitive_keys, new_record - sensitive_keys
  );
  return null;
end;
$$;
revoke all on function public.audit_changes() from public, anon, authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger audit_staff_roles after insert or update or delete on public.staff_roles
  for each row execute function public.audit_changes();

create function public.list_staff_roles()
returns table (email text, roles public.staff_role[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('settings.write') then
    raise exception 'Staff access administration denied' using errcode = '42501';
  end if;

  return query
    select u.email::text, coalesce(array_agg(r.role order by r.role)
      filter (where r.role is not null), '{}'::public.staff_role[])
    from auth.users u
    left join public.staff_roles r on r.user_id = u.id
    where u.email is not null and u.deleted_at is null
    group by u.id, u.email
    order by u.email;
end;
$$;

create function public.update_staff_role(target_email text, target_role public.staff_role, enabled boolean)
returns text
language plpgsql
security definer
set search_path = ''
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
    ) then
      return 'last_administrator';
    end if;
    delete from public.staff_roles where user_id = target_id and role = target_role;
  end if;
  return 'saved';
end;
$$;

revoke all on function public.list_staff_roles() from public, anon;
revoke all on function public.update_staff_role(text, public.staff_role, boolean) from public, anon;
grant execute on function public.list_staff_roles() to authenticated;
grant execute on function public.update_staff_role(text, public.staff_role, boolean) to authenticated;

create table public.school_settings (
  id integer primary key default 1 check (id = 1),
  school_name text not null default 'School Admin Desk' check (length(btrim(school_name)) between 1 and 180),
  division text not null default '',
  region text not null default '',
  school_code text not null default '',
  school_head text not null default '',
  administrative_officer text not null default '',
  disbursing_officer text not null default '',
  inventory_chair text not null default '',
  superintendent text not null default '',
  coa_auditor text not null default '',
  prepared_by text not null default '',
  reference_date date,
  reporting_year integer check (reporting_year between 1900 and 2199),
  step_interval_months integer not null default 36 check (step_interval_months between 1 and 240),
  retirement_age integer not null default 65 check (retirement_age between 18 and 120),
  loyalty_first_years integer not null default 10 check (loyalty_first_years between 1 and 60),
  loyalty_interval_years integer not null default 5 check (loyalty_interval_years between 1 and 60),
  ppe_threshold numeric(14,2) not null default 50000 check (ppe_threshold >= 0),
  semi_expendable_threshold numeric(14,2) not null default 5000 check (semi_expendable_threshold >= 0),
  salary_estimate_percent numeric(6,2) not null default 3 check (salary_estimate_percent between 0 and 100),
  logo_path text check (logo_path ~ '^logos/[a-f0-9-]+[.](png|jpg|webp)$'),
  updated_at timestamptz not null default clock_timestamp(),
  check (semi_expendable_threshold <= ppe_threshold),
  check (greatest(length(division), length(region), length(school_code), length(school_head),
    length(administrative_officer), length(disbursing_officer), length(inventory_chair),
    length(superintendent), length(coa_auditor), length(prepared_by)) <= 180)
);

insert into public.school_settings default values;

create trigger touch_school_settings before update on public.school_settings
  for each row execute function public.touch_updated_at();
create trigger audit_school_settings after update on public.school_settings
  for each row execute function public.audit_changes();

alter table public.school_settings enable row level security;
revoke all on public.school_settings from anon, authenticated;
grant select on public.school_settings to authenticated;
create policy school_settings_read on public.school_settings for select to authenticated
  using ((select public.has_permission('settings.read')));

create function public.update_school_settings(expected_updated_at timestamptz, changes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  value public.school_settings;
begin
  if not coalesce(public.has_permission('settings.write'), false) then
    raise exception 'Settings access denied' using errcode = '42501';
  end if;

  select * into value
  from public.school_settings
  where id = 1 and updated_at = expected_updated_at
  for update;
  if not found then return false; end if;

  value := jsonb_populate_record(value, changes - 'id' - 'updated_at');
  if value.logo_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'school-logos' and name = value.logo_path
  ) then
    raise exception 'Upload the logo before saving settings' using errcode = '23514';
  end if;

  update public.school_settings set
    school_name = value.school_name,
    division = value.division,
    region = value.region,
    school_code = value.school_code,
    school_head = value.school_head,
    administrative_officer = value.administrative_officer,
    disbursing_officer = value.disbursing_officer,
    inventory_chair = value.inventory_chair,
    superintendent = value.superintendent,
    coa_auditor = value.coa_auditor,
    prepared_by = value.prepared_by,
    reference_date = value.reference_date,
    reporting_year = value.reporting_year,
    step_interval_months = value.step_interval_months,
    retirement_age = value.retirement_age,
    loyalty_first_years = value.loyalty_first_years,
    loyalty_interval_years = value.loyalty_interval_years,
    ppe_threshold = value.ppe_threshold,
    semi_expendable_threshold = value.semi_expendable_threshold,
    salary_estimate_percent = value.salary_estimate_percent,
    logo_path = value.logo_path
  where id = 1;
  return true;
end;
$$;
revoke all on function public.update_school_settings(timestamptz, jsonb) from public, anon;
grant execute on function public.update_school_settings(timestamptz, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp']);

create policy school_logo_read on storage.objects for select to authenticated
  using (bucket_id = 'school-logos' and (select public.has_permission('settings.read')));
create policy school_logo_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school-logos'
    and name ~ '^logos/[a-f0-9-]+[.](png|jpg|webp)$'
    and (select public.has_permission('settings.write'))
  );
