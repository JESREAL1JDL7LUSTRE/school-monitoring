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
    union
    select 'super_admin.read' from staff where role = 'admin' and exists (
      select 1 from auth.users where id = (select auth.uid()) and raw_app_meta_data->'super_admin' = 'true'::jsonb
    )
  )
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(role order by role) from staff), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(permission order by permission) from allowed), '[]'::jsonb)
  );
$$;

-- Stamp ownership from the authenticated identity, including writes inside domain RPCs.
create function public.stamp_school_record_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.owner_id := auth.uid();
    select email into new.entered_by_email from auth.users where id = new.owner_id;
  else
    new.owner_id := old.owner_id;
    new.entered_by_email := old.entered_by_email;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_school_record_owner() from public, anon, authenticated;

create index audit_record_origin on public.audit_logs(entity_type,entity_id,id) where action='INSERT';

-- Run privileged business functions under a non-login role subject to row policies.
create role school_record_operator nologin nobypassrls;
grant school_record_operator to postgres;
-- Inherit authenticated schema access for auth.uid() in business functions.
grant authenticated to school_record_operator;
grant usage on schema public to school_record_operator;
grant execute on function public.has_permission(text), public.require_inventory_write() to school_record_operator;

do $$
declare
  rel text;
  predicate text;
begin
  foreach rel in array array['employees','employee_documents','employee_attachments','employee_licenses',
    'employee_salary_history','nosi_records','concern_logs','employee_leaves','calendar_events',
    'inventory_categories','inventory_items','inventory_documents','inventory_transactions','physical_counts','generated_documents']
  loop
    execute format('alter table public.%I add column owner_id uuid, add column entered_by_email text', rel);
    -- Restore original creators from the immutable insertion event, without emitting artificial edits.
    execute format('alter table public.%I disable trigger user', rel);
    execute format('update public.%I t set owner_id=a.user_id, entered_by_email=u.email
      from (select distinct on (entity_id) entity_id,user_id from public.audit_logs
        where entity_type=$1 and action=''INSERT'' order by entity_id,id) a
      left join auth.users u on u.id=a.user_id where t.id::text=a.entity_id', rel) using rel;
    execute format('alter table public.%I enable trigger user',rel);
    execute format('create trigger stamp_owner before insert or update on public.%I
      for each row execute function public.stamp_school_record_owner()',rel);
    execute format('create index on public.%I(owner_id)',rel);
    predicate := 'owner_id=(select auth.uid()) or (select public.has_permission(''super_admin.read''))';
    if rel='inventory_categories' then
      execute format('create policy read_owner on public.%I as restrictive for select using
        (%s or (owner_id is null and id::text ~ ''^22000000-0000-4000-8000-0000000000(0[1-9]|1[0-5])$''))',rel,predicate);
      execute format('create policy update_owner on public.%I as restrictive for update using (%s) with check (%s)',rel,predicate,predicate);
    else
      execute format('create policy record_owner on public.%I as restrictive for all using (%s) with check (%s)',rel,predicate,predicate);
    end if;
    execute format('create policy internal_record_access on public.%I to school_record_operator using (true) with check (true)',rel);
  end loop;
end $$;

-- A foreign key by itself does not check the visibility of its referenced row.
create function public.check_school_record_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  parent_id uuid := nullif(to_jsonb(new)->>tg_argv[1],'')::uuid;
  visible boolean;
begin
  if parent_id is null or auth.uid() is null or public.has_permission('super_admin.read') then return new; end if;
  execute format('select exists(select 1 from public.%I where id=$1 and (owner_id=$2 %s))', tg_argv[0],
    case when tg_argv[0]='inventory_categories' then
      'or (owner_id is null and id::text ~ ''^22000000-0000-4000-8000-0000000000(0[1-9]|1[0-5])$'')' else '' end)
    into visible using parent_id,auth.uid();
  if not visible then raise exception 'Related record unavailable' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function public.check_school_record_parent() from public,anon,authenticated;
do $$
declare rel text;
begin
  foreach rel in array array['employee_documents','employee_attachments','employee_licenses','employee_salary_history',
    'nosi_records','concern_logs','employee_leaves','generated_documents','inventory_documents'] loop
    execute format('create trigger check_employee_owner before insert or update of employee_id on public.%I
      for each row execute function public.check_school_record_parent(''employees'',''employee_id'')',rel);
  end loop;
end $$;
create trigger check_category_owner before insert or update of category_id on public.inventory_items
  for each row execute function public.check_school_record_parent('inventory_categories','category_id');

create policy actor_audit on public.audit_logs as restrictive for select to authenticated
using (user_id=(select auth.uid()) or (select public.has_permission('super_admin.read')));

create policy staff_file_scope on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in ('employee-documents','employee-photos') or (select public.has_permission('super_admin.read'))
  or exists (select 1 from public.employees e where e.owner_id=(select auth.uid())
    and e.id::text=split_part(storage.objects.name,'/',case when bucket_id='employee-photos' then 1 else 2 end))
)
with check (
  bucket_id not in ('employee-documents','employee-photos') or (select public.has_permission('super_admin.read'))
  or exists (select 1 from public.employees e where e.owner_id=(select auth.uid())
    and e.id::text=split_part(storage.objects.name,'/',case when bucket_id='employee-photos' then 1 else 2 end))
);

grant select on public.school_settings, public.form_templates to school_record_operator;
create policy internal_settings_read on public.school_settings for select to school_record_operator using(true);
grant select,update on public.employees to school_record_operator;
grant select, insert, update on public.inventory_categories,public.inventory_items,public.inventory_documents,
  public.inventory_transactions,public.physical_counts,public.generated_documents to school_record_operator;
grant select on public.inventory_issued_lines, public.inventory_balances,public.inventory_stock_card,public.inventory_latest_counts to school_record_operator;
grant usage on sequence public.inventory_document_sequence,public.inventory_transactions_id_seq to school_record_operator;

grant create on schema public to school_record_operator;
do $$
declare fn regprocedure;
begin
  for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
    and proname in ('inventory_employee_directory','employee_custody_summary','employee_custody_totals',
      'post_inventory_document','record_inventory_count','save_inventory_category','save_inventory_item',
      'import_inventory_master','save_generated_document') loop
    execute format('alter function %s owner to school_record_operator',fn);
  end loop;
end $$;
revoke create on schema public from school_record_operator;
