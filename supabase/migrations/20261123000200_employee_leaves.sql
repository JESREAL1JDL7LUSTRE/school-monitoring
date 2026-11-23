create table public.employee_leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  leave_type text not null check (char_length(btrim(leave_type)) between 1 and 80),
  start_date date not null check (start_date >= date '1900-01-01'),
  end_date date not null check (end_date between start_date and date '9999-12-31'),
  updated_at timestamptz not null default clock_timestamp()
);

create index employee_leaves_start_idx on public.employee_leaves (start_date desc, id desc);
create index employee_leaves_employee_idx on public.employee_leaves (employee_id);

alter table public.employee_leaves enable row level security;
revoke all on public.employee_leaves from public, anon, authenticated;
grant select on public.employee_leaves to authenticated;
grant insert (employee_id, leave_type, start_date, end_date) on public.employee_leaves to authenticated;
grant update (leave_type, start_date, end_date) on public.employee_leaves to authenticated;

create policy employee_leaves_read on public.employee_leaves for select to authenticated
  using ((select public.has_permission('personnel.read')));
create policy employee_leaves_insert on public.employee_leaves for insert to authenticated
  with check ((select public.has_permission('personnel.write')) and exists (
    select 1 from public.employees where employees.id = employee_leaves.employee_id and employees.archived_at is null
  ));
create policy employee_leaves_update on public.employee_leaves for update to authenticated
  using ((select public.has_permission('personnel.write')))
  with check ((select public.has_permission('personnel.write')));

create trigger touch_employee_leaves before update on public.employee_leaves
  for each row execute function public.touch_updated_at();
create trigger audit_employee_leaves after insert or update on public.employee_leaves
  for each row execute function public.audit_changes();
