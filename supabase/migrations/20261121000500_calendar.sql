create or replace function public.get_staff_access()
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
    select unnest(case staff.role
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

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  event_date date not null check (event_date between date '1900-01-01' and date '9999-12-31'),
  start_time time(0) without time zone check (start_time < time '24:00'),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index calendar_events_month_idx on public.calendar_events (event_date, start_time, id);

alter table public.calendar_events enable row level security;
revoke all on public.calendar_events from public, anon, authenticated;
grant select on public.calendar_events to authenticated;
grant insert (title, event_date, start_time, notes) on public.calendar_events to authenticated;

create policy calendar_events_read on public.calendar_events for select to authenticated
  using ((select public.has_permission('calendar.read')));

create policy calendar_events_add on public.calendar_events for insert to authenticated
  with check ((select public.has_permission('calendar.write')) and created_by = (select auth.uid()));

create trigger audit_calendar_events after insert on public.calendar_events
  for each row execute function public.audit_changes();
