create policy internal_template_read on public.form_templates for select to school_record_operator using(true);

-- Preserve creator fields on older rows whose insertion audit is unavailable.
do $$
declare entry text[];
begin
  foreach entry slice 1 in array array[
    ['employee_attachments','uploaded_by'],['employee_salary_history','recorded_by'],
    ['concern_logs','created_by'],['calendar_events','created_by'],['inventory_documents','created_by'],
    ['physical_counts','counted_by'],['generated_documents','generated_by']
  ] loop
    execute format('alter table public.%I disable trigger user',entry[1]);
    execute format('update public.%I t set owner_id=t.%I,entered_by_email=u.email from auth.users u
      where t.owner_id is null and t.%I=u.id',entry[1],entry[2],entry[2]);
    execute format('alter table public.%I enable trigger user',entry[1]);
  end loop;
end $$;

create view public.super_admin_records with (security_invoker=true) as
select 'employees'::text as kind,t.id::text as record_id,full_name || ' - ' || employee_no as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employees t where (select public.has_permission('super_admin.read'))
union all
select 'employee_documents'::text as kind,t.id::text as record_id,concat('201 checklist - ',status) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employee_documents t where (select public.has_permission('super_admin.read'))
union all
select 'employee_attachments'::text as kind,t.id::text as record_id,file_name as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employee_attachments t where (select public.has_permission('super_admin.read'))
union all
select 'employee_licenses'::text as kind,t.id::text as record_id,concat(license_type,' - ',expiry_date) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employee_licenses t where (select public.has_permission('super_admin.read'))
union all
select 'employee_salary_history'::text as kind,t.id::text as record_id,concat('Salary grade ',grade,' - Step ',step) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employee_salary_history t where (select public.has_permission('super_admin.read'))
union all
select 'nosi_records'::text as kind,t.id::text as record_id,concat('Step increment - ',status) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.nosi_records t where (select public.has_permission('super_admin.read'))
union all
select 'concern_logs'::text as kind,t.id::text as record_id,description as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.concern_logs t where (select public.has_permission('super_admin.read'))
union all
select 'employee_leaves'::text as kind,t.id::text as record_id,concat(leave_type,' - ',start_date) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.employee_leaves t where (select public.has_permission('super_admin.read'))
union all
select 'calendar_events'::text as kind,t.id::text as record_id,title as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.calendar_events t where (select public.has_permission('super_admin.read'))
union all
select 'inventory_categories'::text as kind,t.id::text as record_id,name as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.inventory_categories t where (select public.has_permission('super_admin.read'))
union all
select 'inventory_items'::text as kind,t.id::text as record_id,item_code || ' - ' || name as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.inventory_items t where (select public.has_permission('super_admin.read'))
union all
select 'inventory_documents'::text as kind,t.id::text as record_id,document_no || ' - ' || kind as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.inventory_documents t where (select public.has_permission('super_admin.read'))
union all
select 'inventory_transactions'::text as kind,t.id::text as record_id,concat('Stock movement - ',quantity_delta) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.inventory_transactions t where (select public.has_permission('super_admin.read'))
union all
select 'physical_counts'::text as kind,t.id::text as record_id,concat('Physical count - ',count_date) as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.physical_counts t where (select public.has_permission('super_admin.read'))
union all
select 'generated_documents'::text as kind,t.id::text as record_id,title as label,t.entered_by_email,
  to_jsonb(t) - array['storage_path','request_payload','owner_id','photo_id'] as details
from public.generated_documents t where (select public.has_permission('super_admin.read'));
revoke all on public.super_admin_records from public,anon,authenticated;
grant select on public.super_admin_records to authenticated;

create function public.super_admin_activity(p_query text, p_email text, p_before bigint default null)
returns table(event_id text, changed_at timestamptz, operation text, kind text, record_id text,
  actor text, entered_by text, before_values jsonb, after_values jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_permission('super_admin.read') then raise insufficient_privilege; end if;
  return query select a.id::text,a.created_at,a.action,a.entity_type,a.entity_id,u.email::text,
    coalesce(a.new_values->>'entered_by_email',a.old_values->>'entered_by_email',creator.email::text),
    a.old_values,a.new_values
    from public.audit_logs a
    left join auth.users u on u.id=a.user_id
    left join lateral (select l.user_id from public.audit_logs l where l.entity_type=a.entity_type
      and l.entity_id=a.entity_id and l.action='INSERT' and l.id<=a.id order by l.id desc limit 1) origin on true
    left join auth.users creator on creator.id=origin.user_id
    where (p_before is null or a.id<p_before) and (p_email='' or u.email=p_email)
      and (p_query='' or strpos(lower(concat_ws(' ',a.entity_type,a.entity_id,a.action,u.email)),lower(p_query))>0)
    order by a.id desc limit 26;
end $$;

create function public.super_admin_overview() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_permission('super_admin.read') then raise insufficient_privilege; end if;
  return jsonb_build_object('accounts',(select count(*) from auth.users where deleted_at is null),
    'employees',(select count(*) from public.employees where archived_at is null),
    'inventory',(select count(*) from public.inventory_items where archived_at is null),
    'week',(select jsonb_agg(jsonb_build_object('day',d.day,'changes',(
      select count(*) from public.audit_logs a where a.created_at >= d.day::timestamp at time zone 'Asia/Manila'
      and a.created_at < (d.day+1)::timestamp at time zone 'Asia/Manila')) order by d.day)
      from (select (now() at time zone 'Asia/Manila')::date-i as day from generate_series(0,6) i) d));
end $$;
revoke all on function public.super_admin_activity(text,text,bigint),public.super_admin_overview() from public,anon,authenticated;
grant execute on function public.super_admin_activity(text,text,bigint),public.super_admin_overview() to authenticated;
