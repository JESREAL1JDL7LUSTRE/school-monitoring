create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text unique not null check (length(employee_no) between 1 and 40),
  full_name text not null check (length(trim(full_name)) between 1 and 180),
  position text not null check (length(trim(position)) between 1 and 150),
  employment_status text not null check (employment_status in ('Permanent', 'Substitute', 'Job Order', 'COS')),
  classification text not null check (classification in ('Teaching', 'Teaching Related', 'NTP')),
  date_of_birth date,
  date_hired date,
  initial_step_date date,
  checklist_review_date date,
  checklist_remarks text not null default '' check (length(checklist_remarks) <= 2000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_hired >= date_of_birth),
  check (initial_step_date >= date_hired)
);

create table public.document_types (
  id smallint primary key,
  name text unique not null,
  sort_order smallint not null default 0,
  active boolean not null default true
);

insert into public.document_types (id, name, sort_order) values
  (1, 'Appointment Papers (CSC Form 33)', 1),
  (2, 'Assumption to Duty', 2),
  (3, 'Oath of Office', 3),
  (4, 'Personal Data Sheet (PDS)', 4),
  (5, 'Position Description Form (PDF)', 5),
  (6, 'Certificate of Eligibility / PRC License', 6),
  (7, 'Designation Orders', 7),
  (8, 'SALN', 8),
  (9, 'NOSA / NOSI', 9),
  (10, 'Medical Certificate (CSC Form 211)', 10),
  (11, 'NBI Clearance', 11),
  (12, 'Diploma and Transcript of Records', 12),
  (13, 'Marriage Certificate', 13),
  (14, 'Certificate of Leave Balances', 14),
  (15, 'Property and Money Accountability Clearance', 15),
  (16, 'Commendations and Awards', 16),
  (17, 'Disciplinary Action Records', 17),
  (18, 'Contract of Service', 18),
  (19, 'Service Record', 19),
  (20, 'IPCRF', 20),
  (21, 'Other 201 Documents', 21);

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  document_type_id smallint not null references public.document_types(id),
  status text not null check (status in ('Pending', 'Complete', 'N/A')),
  updated_at timestamptz not null default now(),
  unique (employee_id, document_type_id)
);

create table public.employee_attachments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  document_type_id smallint not null references public.document_types(id),
  storage_path text unique not null,
  file_name text not null check (length(file_name) between 1 and 240),
  content_type text not null check (content_type in ('application/pdf','image/png','image/jpeg')),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null
);

create table public.employee_licenses (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  license_type text not null check (length(trim(license_type)) between 1 and 80),
  license_number text not null default '' check (length(license_number) <= 100),
  expiry_date date not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index employee_licenses_employee on public.employee_licenses(employee_id);

create table public.employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  grade smallint not null check (grade between 1 and 33),
  step smallint not null check (step between 1 and 8),
  monthly_salary numeric(14,2) not null check (monthly_salary >= 0),
  effective_from date not null,
  reason text not null check (length(trim(reason)) between 1 and 300),
  reference_no text not null default '' check (length(reference_no) <= 100),
  resets_step_date boolean not null default false,
  created_at timestamptz not null default now(),
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  unique (employee_id, effective_from)
);

create table public.nosi_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  previous_step_date date not null,
  eligibility_date date not null check (eligibility_date >= previous_step_date),
  status text not null check (status in ('Not filed', 'On-process', 'Submitted to D.O.', 'Adjusted in payslip')),
  updated_at timestamptz not null default now(),
  unique (employee_id, previous_step_date)
);

create table public.concern_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  description text not null check (length(trim(description)) between 1 and 2000),
  assigned_to text not null default '' check (length(assigned_to) <= 180),
  category text not null check (category in ('201 Documents','PRC License','NOSI','Loyalty','Retirement','Salary','Other')),
  priority text not null check (priority in ('Low','Medium','High','Urgent')),
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed')),
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  check ((status in ('Resolved','Closed')) = (resolved_on is not null))
);

create index concern_logs_employee on public.concern_logs(employee_id);
create index employee_attachments_document on public.employee_attachments(employee_id, document_type_id);

do $$
declare
  rel text;
begin
  foreach rel in array array['employees', 'document_types', 'employee_documents', 'employee_attachments', 'employee_licenses', 'employee_salary_history', 'nosi_records', 'concern_logs'] loop
    execute format('alter table public.%I enable row level security', rel);
    execute format('revoke all on public.%I from anon, authenticated', rel);
    execute format('grant select on public.%I to authenticated', rel);
    execute format('create policy read_personnel on public.%I for select to authenticated using ((select public.has_permission(%L)))',
      rel, case when rel = 'employee_attachments' then 'files.read' else 'personnel.read' end);
  end loop;

  foreach rel in array array['employees', 'employee_documents', 'employee_licenses', 'nosi_records', 'concern_logs'] loop
    execute format('create policy insert_personnel on public.%I for insert to authenticated with check ((select public.has_permission(%L)))', rel, 'personnel.write');
    execute format('create policy update_personnel on public.%I for update to authenticated using ((select public.has_permission(%L))) with check ((select public.has_permission(%L)))', rel, 'personnel.write', 'personnel.write');
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()', rel);
  end loop;

  foreach rel in array array['employees', 'employee_documents', 'employee_attachments', 'employee_licenses', 'employee_salary_history', 'nosi_records', 'concern_logs'] loop
    execute format('create trigger audit_changes after insert or update on public.%I for each row execute function public.audit_changes()', rel);
  end loop;
end $$;

grant insert (employee_no, full_name, position, classification, employment_status, date_of_birth, date_hired, initial_step_date),
  update (employee_no, full_name, position, classification, employment_status, date_of_birth, date_hired, initial_step_date, checklist_review_date, checklist_remarks, archived_at)
  on public.employees to authenticated;
grant insert (employee_id, document_type_id, status), update (status)
  on public.employee_documents to authenticated;
grant insert (employee_id, license_type, license_number, expiry_date), update (license_type, license_number, expiry_date, is_active)
  on public.employee_licenses to authenticated;
grant insert (employee_id, previous_step_date, eligibility_date, status), update (status, eligibility_date)
  on public.nosi_records to authenticated;
grant insert (employee_id, description, assigned_to, category, priority), update (status, resolved_on)
  on public.concern_logs to authenticated;

grant insert (employee_id, grade, step, monthly_salary, effective_from, reason, reference_no, resets_step_date) on public.employee_salary_history to authenticated;
create policy append_salary_history on public.employee_salary_history for insert to authenticated
  with check ((select public.has_permission('personnel.write')));

create function public.create_employee(
  p_profile jsonb, p_salary jsonb default null, p_license_expiry date default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_id uuid;
begin
  if not public.has_permission('personnel.write') then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  insert into public.employees (employee_no, full_name, position, employment_status, classification, date_of_birth, date_hired, initial_step_date)
  values (p_profile->>'employee_no', p_profile->>'full_name', p_profile->>'position', p_profile->>'employment_status',
    p_profile->>'classification', (p_profile->>'date_of_birth')::date, (p_profile->>'date_hired')::date, (p_profile->>'initial_step_date')::date)
  returning id into new_id;
  if p_salary is not null then
    insert into public.employee_salary_history (employee_id, grade, step, monthly_salary, effective_from, reason)
    values (new_id, (p_salary->>'grade')::smallint, (p_salary->>'step')::smallint, (p_salary->>'monthly_salary')::numeric,
      (p_salary->>'effective_from')::date, 'Opening salary record');
  end if;
  if p_license_expiry is not null then
    insert into public.employee_licenses (employee_id, license_type, expiry_date)
    values (new_id, 'PRC', p_license_expiry);
  end if;
  return new_id;
end;
$$;
revoke all on function public.create_employee(jsonb, jsonb, date) from public, anon, authenticated;
grant execute on function public.create_employee(jsonb, jsonb, date) to authenticated;

create or replace function public.inventory_employee_directory()
returns table(id uuid, employee_no text, full_name text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.employee_no, e.full_name
  from public.employees e
  where e.archived_at is null and (select public.has_permission('inventory.read'))
  order by e.full_name, e.id;
$$;
revoke all on function public.inventory_employee_directory() from public, anon, authenticated;
grant execute on function public.inventory_employee_directory() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-documents', 'employee-documents', false, 10485760, array['application/pdf','image/png','image/jpeg']);

grant insert (employee_id, document_type_id, storage_path, file_name, content_type) on public.employee_attachments to authenticated;
create policy register_employee_attachment on public.employee_attachments for insert to authenticated
with check (
  (select public.has_permission('files.write'))
  and split_part(storage_path, '/', 1) = (select auth.uid())::text
  and split_part(storage_path, '/', 2) = employee_id::text
  and split_part(storage_path, '/', 3) = document_type_id::text
  and exists (select 1 from public.employees e where e.id = employee_id and e.archived_at is null)
  and exists (select 1 from public.document_types d where d.id = document_type_id and d.active)
);

create function public.verify_employee_attachment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'employee-documents' and o.name = new.storage_path
  ) then
    raise exception 'Employee attachment object is missing' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.verify_employee_attachment() from public, anon, authenticated;
create trigger verify_employee_attachment before insert on public.employee_attachments
  for each row execute function public.verify_employee_attachment();

create policy read_employee_object on storage.objects for select to authenticated
using (
  bucket_id = 'employee-documents'
  and (select public.has_permission('files.read'))
  and (
    exists (select 1 from public.employee_attachments a where a.storage_path = storage.objects.name)
    or ((select public.has_permission('files.write')) and split_part(name, '/', 1) = (select auth.uid())::text)
  )
);

create policy upload_employee_object on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-documents'
  and (select public.has_permission('files.write'))
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[0-9]+/[a-f0-9-]{36}$'
  and exists (select 1 from public.employees e where e.id::text = split_part(storage.objects.name, '/', 2) and e.archived_at is null)
  and exists (select 1 from public.document_types d where d.id::text = split_part(storage.objects.name, '/', 3) and d.active)
);

create policy remove_unregistered_employee_object on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-documents'
  and (select public.has_permission('files.write'))
  and split_part(name, '/', 1) = (select auth.uid())::text
  and not exists (select 1 from public.employee_attachments a where a.storage_path = storage.objects.name)
);
