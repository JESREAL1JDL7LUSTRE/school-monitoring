\set ON_ERROR_STOP on
begin;

-- Run against the seeded local database. Roll back all synthetic rows.
select id as administrator from auth.users where email = 'admin@school.example' \gset
-- This paging test includes unattributed seed data across the school.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"super_admin":true}' where id = :'administrator';
insert into public.employees (employee_no, full_name, position, employment_status, classification)
select 'TEST-READS-' || n, 'Synthetic directory employee', 'Test position', 'Permanent', 'NTP'
from generate_series(1, 2000) n;

create temporary table activity_fixture as
with chosen_items as (
  select distinct on (category_id) id, category_id from public.inventory_items order by category_id, id
)
select
  (select id from chosen_items order by category_id limit 1) as matching_item,
  (select category_id from chosen_items order by category_id limit 1) as matching_category,
  (select id from chosen_items order by category_id offset 1 limit 1) as other_item;
grant select on activity_fixture to authenticated;

insert into public.inventory_documents (document_no, kind, form_type, transaction_date, snapshot, created_at)
select 'TEST-READS-' || n, 'receipt', 'Receipt', current_date, '{}'::jsonb,
  clock_timestamp() + (n || ' seconds')::interval
from generate_series(0, 30) n;
insert into public.inventory_transactions (document_id, item_id, quantity_delta, unit_cost)
select d.id, case when d.document_no = 'TEST-READS-0' then f.matching_item else f.other_item end, 1, 0
from public.inventory_documents d cross join activity_fixture f
cross join lateral generate_series(1, case when d.document_no = 'TEST-READS-0' then 3 else 667 end)
where d.document_no like 'TEST-READS-%';

insert into public.physical_counts (item_id, count_date, counted_quantity, recorded_quantity, unit_cost)
select matching_item, current_date + days, quantity, 0, 0
from activity_fixture cross join (values (1, 7.5), (2, 8.25)) expected(days, quantity);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'administrator', 'role', 'authenticated')::text, true);
do $$
declare
  fixture record;
  payload jsonb;
  directory_ids uuid[];
  paged_ids uuid[];
  first_page text[];
  older_page text[];
  cutoff_at timestamptz;
  cutoff_id bigint;
begin
  select * into fixture from activity_fixture;
  if exists (select from public.recent_inventory_activity() where document_no = 'TEST-READS-0') then
    raise exception 'The scoped fixture must be older than the global top 25';
  end if;
  if (select count(*) from public.recent_inventory_activity(p_category => fixture.matching_category,
      p_item => fixture.matching_item) where document_no = 'TEST-READS-0') <> 1 then
    raise exception 'Category or item scope lost or duplicated the older matching document';
  end if;

  select array_agg(id order by full_name, id) into directory_ids from public.inventory_employee_directory();
  select array_agg(id order by full_name, id) into paged_ids
  from generate_series(0, 4) page(n)
  cross join lateral (
    select * from public.inventory_employee_directory() order by full_name, id offset (page.n * 500) limit 500
  ) directory_page;
  if cardinality(directory_ids) < 2000 or directory_ids is distinct from paged_ids then
    raise exception 'The employee directory paging skipped or repeated directory entries';
  end if;

  select public.personnel_list_page(current_date, extract(year from current_date)::int, 36, 65, 10, 5,
    'Synthetic directory employee', 'all', 0, 25) into payload;
  if jsonb_array_length(payload->'rows') <> 25 or (payload->>'total')::int <> 2000 then
    raise exception 'The employee page and total diverged';
  end if;
  if (select (facets->>'all')::int from public.personnel_home_counts()) is distinct from cardinality(directory_ids) then
    raise exception 'Home active-employee counts diverged from the directory';
  end if;
  if (select count(*) from (select id from public.inventory_item_list() order by name, id limit 25) items) <> 25 then
    raise exception 'Expected a full 25-item inventory page';
  end if;
  if (select count(*) from public.inventory_stock_card_page(fixture.other_item)) <> 26 then
    raise exception 'Stock card failed to bound its first page including the look-ahead row';
  end if;
  if (select counted_quantity from public.inventory_counts_as_of(current_date + 1) where item_id = fixture.matching_item)
      is distinct from 7.5 then
    raise exception 'As-of count picked a future physical count';
  end if;

  select array_agg(id order by created_at desc, id::bigint desc) into first_page from (
    select * from public.audit_log_page() order by created_at desc, id::bigint desc limit 25
  ) first_rows;
  select created_at, id::bigint into cutoff_at, cutoff_id
  from public.audit_log_page() order by created_at desc, id::bigint desc offset 24 limit 1;
  select array_agg(id) into older_page from public.audit_log_page(cutoff_at, cutoff_id);
  if cardinality(first_page) <> 25 or cardinality(older_page) <> 26 or first_page && older_page then
    raise exception 'Audit cursor repeated an entry or returned the wrong page size';
  end if;
end
$$;
rollback;
