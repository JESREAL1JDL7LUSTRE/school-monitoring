\set ON_ERROR_STOP on
-- Exercise the seeded local roles. All changes roll back.
begin;
select id as a from auth.users where email='admin@school.example' \gset
select id as b from auth.users where email='personnel@school.example' \gset
select id as supervisor from auth.users where email='head@school.example' \gset
insert into public.staff_roles(user_id,role) values (:'b','admin'),(:'supervisor','admin') on conflict do nothing;
update auth.users set raw_app_meta_data=raw_app_meta_data || '{"super_admin":true}' where id=:'supervisor';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'a','role','authenticated')::text,true);
select public.create_employee('{"employee_no":"OWNERSHIP-A","full_name":"Ownership test teacher A","position":"Teacher","employment_status":"Permanent","classification":"NTP"}');
select public.save_inventory_item(null,null,'{"category_id":"22000000-0000-4000-8000-000000000001","item_code":"OWNERSHIP-A","name":"Test stock","unit":"pcs","unit_cost":1}') as item \gset
select public.record_inventory_count(:'item',0,current_date,'','');
select set_config('request.jwt.claims',json_build_object('sub',:'b','role','authenticated')::text,true);
select public.create_employee('{"employee_no":"OWNERSHIP-B","full_name":"Ownership test teacher B","position":"Teacher","employment_status":"Permanent","classification":"NTP"}');
do $$
begin
  if (select count(*) from public.employees where employee_no like 'OWNERSHIP-%') <> 1
    or not exists(select from public.employees where employee_no='OWNERSHIP-B' and entered_by_email='personnel@school.example')
    or exists(select from public.inventory_employee_directory() where employee_no='OWNERSHIP-A')
    or exists(select from public.inventory_item_list() where item_code='OWNERSHIP-A')
    or exists(select from public.audit_logs where user_id<>auth.uid())
    or exists(select from public.super_admin_records)
    then raise exception 'Private staff scope failed'; end if;
  begin
    perform public.super_admin_overview();
    raise exception 'Ordinary administrator could open overview';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',:'supervisor','role','authenticated')::text,true);
do $$
begin
  if (select count(distinct entered_by_email) from public.super_admin_records where kind='employees' and label like 'Ownership test teacher%') <> 2
    or not exists(select from public.super_admin_activity('employees','personnel@school.example') where entered_by='personnel@school.example')
    or not exists(select from public.inventory_item_list() where item_code='OWNERSHIP-A')
    or public.super_admin_overview()->'week' is null
    then raise exception 'Super admin school-wide scope failed'; end if;
end $$;
rollback;
