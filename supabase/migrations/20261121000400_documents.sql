create table public.form_templates (
  slug text not null,
  version integer not null check (version > 0),
  title text not null,
  scope text not null check (scope in ('personnel', 'private-personnel', 'inventory')),
  requires_employee boolean not null,
  active boolean not null default true,
  primary key (slug, version)
);

insert into public.form_templates (slug, version, title, scope, requires_employee) values
  ('service-record', 1, 'Service Record', 'personnel', true),
  ('leave-form', 1, 'Leave Form (CSC Form 6)', 'personnel', true),
  ('authority-to-travel', 1, 'Authority to Travel', 'personnel', true),
  ('certificate-of-employment', 1, 'Certificate of Employment', 'personnel', true),
  ('locator-slip', 1, 'Locator Slip', 'personnel', true),
  ('service-credit', 1, 'Request for Service Credit / COC', 'personnel', true),
  ('certificate-of-appearance', 1, 'Certificate of Appearance', 'personnel', true),
  ('4ps-certification', 1, '4Ps Certification', 'personnel', false),
  ('medical-certificate', 1, 'CSC Medical Certificate', 'private-personnel', true),
  ('school-level-clearance', 1, 'School Level Clearance', 'personnel', true),
  ('modification-advice', 1, 'Modification Advice', 'personnel', false),
  ('waiver-of-responsibility', 1, 'Waiver of Responsibility', 'personnel', true),
  ('advice-of-checks-issued', 1, 'Advice of Checks Issued', 'personnel', false),
  ('schedule-of-funds', 1, 'Schedule of Funds', 'personnel', false),
  ('transmittal', 1, 'Transmittal Form', 'personnel', false),
  ('total-personnel', 1, 'Total Personnel Report', 'personnel', false),
  ('district-level-clearance', 1, 'District Level Clearance', 'personnel', true),
  ('pendency', 1, 'Pendency / Non-Pendency', 'private-personnel', true),
  ('saln', 1, 'SALN', 'private-personnel', true),
  ('employee-201', 1, '201 File Checklist', 'personnel', true),
  ('nosi', 1, 'Notice of Step Increment', 'personnel', true);

create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null,
  template_version integer not null,
  title text not null,
  scope text not null check (scope in ('personnel', 'private-personnel', 'inventory')),
  employee_id uuid references public.employees(id) on delete restrict,
  generated_by uuid not null,
  created_at timestamptz not null default now(),
  snapshot jsonb not null check (
    jsonb_typeof(snapshot) = 'object' and
    snapshot ?& array['layout', 'school', 'issuedOn', 'sections', 'parameters'] and
    snapshot->>'layout' = '1' and
    octet_length(snapshot::text) <= 200000
  ),
  foreign key (template_slug, template_version) references public.form_templates(slug, version) on delete restrict
);

create index generated_documents_created_idx on public.generated_documents (created_at desc, id);

alter table public.form_templates enable row level security;
alter table public.generated_documents enable row level security;
revoke all on public.form_templates, public.generated_documents from public, anon, authenticated;
grant select on public.generated_documents to authenticated;

create policy generated_documents_access on public.generated_documents for select to authenticated
using (
  (scope = 'personnel' and (select public.has_permission('personnel.read'))) or
  (scope = 'private-personnel' and (select public.has_permission('personnel.read')) and (select public.has_permission('files.read'))) or
  (scope = 'inventory' and (select public.has_permission('inventory.read')))
);

create trigger audit_generated_document after insert on public.generated_documents
  for each row execute function public.audit_changes();

create function public.save_generated_document(p_slug text, p_version integer, p_employee_id uuid, p_snapshot jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  template public.form_templates;
  result uuid;
begin
  select * into template from public.form_templates
  where slug = p_slug and version = p_version and active;
  if not found or auth.uid() is null or not (
    (template.scope = 'personnel' and public.has_permission('personnel.write')) or
    (template.scope = 'private-personnel' and public.has_permission('personnel.write') and public.has_permission('files.write')) or
    (template.scope = 'inventory' and public.has_permission('inventory.write'))
  ) then
    raise exception 'Document generation denied' using errcode = '42501';
  end if;
  if template.requires_employee is distinct from (p_employee_id is not null) then
    raise exception 'Template does not match the employee selection' using errcode = '23514';
  end if;

  insert into public.generated_documents (template_slug, template_version, title, scope, employee_id, generated_by, snapshot)
  values (template.slug, template.version, template.title, template.scope, p_employee_id, auth.uid(), p_snapshot)
  returning id into result;
  return result;
end;
$$;

revoke all on function public.save_generated_document(text, integer, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_generated_document(text, integer, uuid, jsonb) to authenticated;
