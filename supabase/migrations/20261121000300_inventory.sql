create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  category_type text not null check (category_type in ('supplies', 'books', 'equipment', 'building')),
  updated_at timestamptz not null default clock_timestamp()
);

insert into public.inventory_categories (id,name,category_type) values
 ('22000000-0000-4000-8000-000000000001','Office Supplies','supplies'),
 ('22000000-0000-4000-8000-000000000002','Learning Resources','books'),
 ('22000000-0000-4000-8000-000000000003','ICT Equipment','equipment'),
 ('22000000-0000-4000-8000-000000000004','Science and Math','equipment'),
 ('22000000-0000-4000-8000-000000000005','Sports Equipment','equipment'),
 ('22000000-0000-4000-8000-000000000006','TLE Equipment','equipment'),
 ('22000000-0000-4000-8000-000000000007','SHS Equipment','equipment'),
 ('22000000-0000-4000-8000-000000000008','Office Equipment','equipment'),
 ('22000000-0000-4000-8000-000000000009','WINS / Clinic','equipment'),
 ('22000000-0000-4000-8000-000000000010','DRRM','equipment'),
 ('22000000-0000-4000-8000-000000000011','School Building','building'),
 ('22000000-0000-4000-8000-000000000012','Furniture and Fixtures','equipment'),
 ('22000000-0000-4000-8000-000000000013','Donation','equipment'),
 ('22000000-0000-4000-8000-000000000014','Canteen Property','equipment'),
 ('22000000-0000-4000-8000-000000000015','Equipment over ₱50K','equipment');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.inventory_categories(id),
  item_code text not null unique check (length(btrim(item_code)) between 1 and 80),
  name text not null check (length(btrim(name)) between 1 and 200),
  unit text not null check (length(btrim(unit)) between 1 and 40),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  reorder_point numeric(14,3) not null default 5 check (reorder_point >= 0),
  condition text not null default 'Serviceable' check (condition in ('Serviceable','For repair','Unserviceable')),
  description text not null default '',
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz
);
create index inventory_items_category_idx on public.inventory_items(category_id);

create sequence public.inventory_document_sequence;
create table public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  document_no text not null unique,
  kind text not null check (kind in ('receipt', 'issue', 'return', 'adjustment', 'disposal')),
  form_type text not null,
  transaction_date date not null,
  created_by uuid,
  employee_id uuid references public.employees(id),
  reference text not null default '',
  request_id uuid unique,
  request_payload jsonb,
  template_version integer not null default 1,
  snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create index inventory_documents_employee_idx on public.inventory_documents(employee_id, kind);

create table public.inventory_transactions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.inventory_documents(id),
  item_id uuid not null references public.inventory_items(id),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  issue_line_id bigint references public.inventory_transactions(id)
);
create index inventory_transactions_item_idx on public.inventory_transactions(item_id,id);
create index inventory_transactions_document_idx on public.inventory_transactions(document_id);
create index inventory_transactions_issue_idx on public.inventory_transactions(issue_line_id) where issue_line_id is not null;

create table public.physical_counts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id),
  count_date date not null,
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  recorded_quantity numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  location text not null default '',
  remarks text not null default '',
  counted_by uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index physical_counts_item_idx on public.physical_counts(item_id, count_date desc, created_at desc);

create view public.inventory_balances with (security_invoker = true) as
  select i.id as item_id, coalesce(sum(t.quantity_delta), 0)::numeric as balance,
    coalesce(sum(t.quantity_delta) filter (where d.kind = 'receipt'), 0)::numeric as total_received
  from public.inventory_items i
  left join public.inventory_transactions t on t.item_id = i.id
  left join public.inventory_documents d on d.id = t.document_id
  group by i.id;

create view public.inventory_issued_lines with (security_invoker = true) as
  select t.id as issue_line_id, t.item_id, d.id as document_id, d.document_no, d.form_type,
    d.employee_id, d.transaction_date, -t.quantity_delta as issued_quantity,
    coalesce(sum(r.quantity_delta),0)::numeric as returned_quantity,
    -t.quantity_delta - coalesce(sum(r.quantity_delta),0) as outstanding,
    d.snapshot->>'employee_name' as employee_name
  from public.inventory_transactions t
  join public.inventory_documents d on d.id = t.document_id and d.kind = 'issue'
  left join public.inventory_transactions r on r.issue_line_id = t.id
  group by t.id, d.id;

create view public.inventory_latest_counts with (security_invoker = true) as
  select distinct on (item_id) *
    from public.physical_counts
    order by item_id, count_date desc, created_at desc, id desc;

create view public.inventory_stock_card with (security_invoker = true) as
  select t.*, d.document_no, d.kind, d.transaction_date,
    sum(t.quantity_delta) over (partition by t.item_id order by d.transaction_date, t.id) as running_balance
  from public.inventory_transactions t join public.inventory_documents d on d.id = t.document_id;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inventory_categories', 'inventory_items', 'inventory_documents', 'inventory_transactions', 'physical_counts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('create policy inventory_read on public.%I for select to authenticated using
      ((select public.has_permission(''inventory.read'')))', table_name);
    execute format('create trigger inventory_audit after insert or update or delete on public.%I
      for each row execute function public.audit_changes()', table_name);
  end loop;
end;
$$;

revoke all on public.inventory_balances, public.inventory_issued_lines, public.inventory_latest_counts,
  public.inventory_stock_card from anon, authenticated;
grant select on public.inventory_balances, public.inventory_issued_lines, public.inventory_latest_counts,
  public.inventory_stock_card to authenticated;

create trigger touch_inventory_item before update on public.inventory_items
  for each row execute function public.touch_updated_at();
create trigger touch_inventory_category before update on public.inventory_categories
  for each row execute function public.touch_updated_at();

create function public.require_inventory_write()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission('inventory.write') then
    raise exception 'Inventory write access denied' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.require_inventory_write() from public, anon, authenticated;

create function public.post_inventory_document(
  p_kind text, p_date date, p_lines jsonb, p_employee_id uuid default null,
  p_reference text default '', p_request_id uuid default null, p_disposal_details jsonb default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.inventory_documents;
  v_request jsonb;
  v_document uuid := gen_random_uuid();
  v_ref text;
  v_actor uuid := auth.uid();
  v_employee text;
  v_settings public.school_settings;
  v_form text;
  v_snapshot jsonb;
  v_data jsonb;
  v_balance numeric;
  v_issue public.inventory_issued_lines;
  v_recipient uuid := p_employee_id;
  v_item record;
  v_line record;
  v_last_date date;
  v_locked int := 0;
begin
  perform public.require_inventory_write();
  if p_kind is null or p_kind not in ('receipt','issue','return','adjustment','disposal')
    or p_date is null or p_date < date '1900-01-01' or p_date > (now() at time zone 'Asia/Manila')::date
    or p_lines is null or jsonb_typeof(p_lines) <> 'array'
    or length(coalesce(p_reference,'')) > 500 then
    raise exception 'Check the transaction details';
  end if;
  if jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'Add between 1 and 100 transaction lines';
  end if;
  if p_disposal_details is not null and (
    p_kind <> 'disposal' or jsonb_typeof(p_disposal_details) <> 'object'
    or coalesce(p_disposal_details->>'method','') not in ('Sale','Transfer without cost','Destroy','Waste material')
    or (p_disposal_details->>'receipt_number' is not null and jsonb_typeof(p_disposal_details->'receipt_number') <> 'string')
    or length(coalesce(p_disposal_details->>'receipt_number','')) > 120
    or (p_disposal_details->>'proceeds' is not null and
      (jsonb_typeof(p_disposal_details->'proceeds') <> 'number'
        or p_disposal_details->>'proceeds' !~ '^[0-9]{1,12}([.][0-9]{1,2})?$'))
    or (p_disposal_details->>'proceeds' is not null and nullif(btrim(p_disposal_details->>'receipt_number'),'') is null)
  ) then raise exception 'Check the disposal method, receipt number, and proceeds';
  end if;
  if p_kind = 'disposal' and p_disposal_details is null and nullif(btrim(p_reference), '') is null then
    raise exception 'Record the disposal method and reference';
  end if;
  v_request := jsonb_build_object('kind',p_kind,'date',p_date,'employee',p_employee_id,
    'reference',coalesce(p_reference,''),'lines',p_lines,'disposal_details',p_disposal_details);
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1));
    select * into v_existing from public.inventory_documents where request_id = p_request_id;
    if found then
      if v_existing.created_by is distinct from v_actor or v_existing.request_payload is distinct from v_request then
        raise exception 'This request was already used for a different transaction' using errcode = '23505';
      end if;
      return v_existing.id;
    end if;
  end if;
  if exists (select 1 from jsonb_to_recordset(p_lines) as x(item_id uuid, quantity numeric, issue_line_id bigint, unit_cost numeric)
    where x.item_id is null or x.quantity is null or abs(x.quantity) not between 0.001 and 99999999999.999
       or x.quantity <> round(x.quantity,3) or (p_kind <> 'adjustment' and x.quantity < 0)
       or (p_kind = 'return') <> (x.issue_line_id is not null)
       or (x.unit_cost is not null and (p_kind <> 'receipt' or x.unit_cost not between 0 and 999999999999.99
          or x.unit_cost <> round(x.unit_cost,2)))) then
    raise exception 'Check item, quantity, cost, and return reference on each line';
  end if;
  if (p_kind = 'issue') <> (p_employee_id is not null) then
    raise exception 'An issue requires an active employee';
  end if;
  if p_kind = 'issue' then
    select full_name into v_employee from public.employees
      where id = p_employee_id and archived_at is null for share;
    if not found then raise exception 'Choose an active employee'; end if;
  end if;

  select * into strict v_settings from public.school_settings where id = 1;
  for v_item in
    select i.*, c.name as category_name, c.category_type, x.total
      from public.inventory_items i
      join public.inventory_categories c on c.id = i.category_id
      join (select l.item_id, sum(l.quantity) as total from jsonb_to_recordset(p_lines)
        as l(item_id uuid, quantity numeric) group by l.item_id) x on x.item_id = i.id
      order by i.id for update of i for share of c
  loop
    v_locked := v_locked + 1;
    if v_item.archived_at is not null then raise exception 'Item % is archived', v_item.item_code; end if;
    select coalesce(sum(t.quantity_delta),0), max(d.transaction_date) into v_balance, v_last_date
      from public.inventory_transactions t join public.inventory_documents d on d.id = t.document_id
      where t.item_id = v_item.id;
    if p_date < v_last_date then raise exception 'Transaction date is earlier than the latest posting for %', v_item.item_code; end if;
    if p_kind = 'adjustment' and exists (
      select 1 from jsonb_to_recordset(p_lines) as l(item_id uuid, quantity numeric)
        where l.item_id = v_item.id having count(*) > 1
    ) then raise exception 'Enter one adjustment line per item'; end if;
    if (p_kind in ('issue','disposal') and v_balance < v_item.total)
      or (p_kind = 'adjustment' and v_balance + v_item.total < 0) then
      raise exception 'Insufficient stock for % (% available)', v_item.item_code, v_balance;
    end if;
    if (p_kind = 'disposal' and v_item.condition <> 'Unserviceable') or
       (p_kind = 'issue' and v_item.condition <> 'Serviceable') then
      raise exception 'Item % cannot be posted for this condition', v_item.item_code;
    end if;
    if p_kind = 'issue' then
      v_ref := case when v_item.category_type = 'supplies' then 'RIS'
                    when v_item.category_type = 'building' or v_item.unit_cost >= v_settings.ppe_threshold then 'PAR'
                    else 'ICS' end;
      if v_form is not null and v_form <> v_ref then
        raise exception 'Use separate issues for items that require different forms';
      end if;
      v_form := v_ref;
    end if;
  end loop;
  if v_locked <> (select count(distinct l.item_id) from jsonb_to_recordset(p_lines) as l(item_id uuid)) then
    raise exception 'An item does not exist';
  end if;

  if p_kind = 'return' then
    for v_line in select issue_line_id, item_id, sum(quantity) as quantity
      from jsonb_to_recordset(p_lines) as l(issue_line_id bigint, item_id uuid, quantity numeric)
      group by issue_line_id,item_id
    loop
      select * into v_issue from public.inventory_issued_lines where issue_line_id = v_line.issue_line_id;
      if not found or v_issue.item_id <> v_line.item_id or v_issue.outstanding < v_line.quantity
        or p_date < v_issue.transaction_date then
        raise exception 'Return quantity or date does not match the original issue';
      end if;
      if v_recipient is not null and v_recipient <> v_issue.employee_id then
        raise exception 'Use separate returns for different employees';
      end if;
      v_recipient := v_issue.employee_id;
      v_employee := v_issue.employee_name;
    end loop;
  end if;

  v_form := coalesce(v_form, upper(p_kind));
  v_ref := v_form || '-' || extract(year from p_date)::text || '-' ||
    lpad(nextval('public.inventory_document_sequence')::text, 8, '0');

  select jsonb_agg(jsonb_build_object(
    'item_id',i.id,'item_code',i.item_code,'name',i.name,'category',c.name,'unit',i.unit,
    'classification',case
      when c.category_type = 'supplies' then 'Consumable'
      when c.category_type = 'building' or i.unit_cost >= v_settings.ppe_threshold then 'PPE'
      when i.unit_cost > v_settings.semi_expendable_threshold then 'High-value semi-expendable'
      else 'Low-value semi-expendable' end,
    'quantity',l.quantity, 'unit_cost',coalesce(l.unit_cost,original.unit_cost,i.unit_cost),
    'issue_line_id',l.issue_line_id,'issue_document_no',od.document_no
  ) order by l.line_no) into v_data
    from rows from (jsonb_to_recordset(p_lines) as (item_id uuid, quantity numeric, issue_line_id bigint, unit_cost numeric))
      with ordinality l(item_id, quantity, issue_line_id, unit_cost, line_no)
    join public.inventory_items i on i.id = l.item_id
    join public.inventory_categories c on c.id = i.category_id
    left join public.inventory_transactions original on original.id = l.issue_line_id
    left join public.inventory_documents od on od.id = original.document_id;

  v_snapshot := jsonb_build_object('school',to_jsonb(v_settings),'employee_name',v_employee,'lines',v_data,
    'disposal',case when p_kind = 'disposal' then jsonb_strip_nulls(jsonb_build_object(
      'method',coalesce(p_disposal_details->>'method',p_reference),
      'receipt_number',p_disposal_details->>'receipt_number','proceeds',p_disposal_details->'proceeds'
    )) end);
  insert into public.inventory_documents (id,document_no,kind,form_type,transaction_date,created_by,employee_id,
    reference,request_id,request_payload,snapshot)
    values (v_document,v_ref,p_kind,v_form,p_date,v_actor,v_recipient,coalesce(p_reference,''),p_request_id,v_request,v_snapshot);

  insert into public.inventory_transactions (document_id,item_id,quantity_delta,unit_cost,issue_line_id)
  select v_document, item_id, case when p_kind in ('issue','disposal') then -quantity else quantity end, unit_cost, issue_line_id
  from jsonb_to_recordset(v_data) as l(item_id uuid, quantity numeric, unit_cost numeric, issue_line_id bigint);

  return v_document;
end;
$$;

create function public.record_inventory_count(
  p_item_id uuid, p_quantity numeric, p_date date, p_location text, p_remarks text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_item public.inventory_items;
  v_balance numeric;
  v_id uuid;
begin
  perform public.require_inventory_write();
  if p_quantity is null or p_quantity not between 0 and 99999999999.999 or p_quantity <> round(p_quantity,3)
     or p_date is null or p_date not between date '1900-01-01' and (now() at time zone 'Asia/Manila')::date
     or length(coalesce(p_location,'')) > 200 or length(coalesce(p_remarks,'')) > 1000 then
    raise exception 'Check the count details';
  end if;
  select * into v_item from public.inventory_items where id = p_item_id and archived_at is null for update;
  if not found then raise exception 'Choose an active item'; end if;
  select coalesce(sum(t.quantity_delta),0) into v_balance
    from public.inventory_transactions t join public.inventory_documents d on d.id = t.document_id
    where t.item_id = p_item_id and d.transaction_date <= p_date;
  insert into public.physical_counts (item_id,count_date,counted_quantity,recorded_quantity,unit_cost,location,remarks,counted_by)
    values (p_item_id,p_date,p_quantity,v_balance,v_item.unit_cost,coalesce(p_location,''),coalesce(p_remarks,''),auth.uid())
    returning id into v_id;
  return v_id;
end;
$$;

create function public.save_inventory_category(p_id uuid, p_expected timestamptz, p_name text, p_type text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.require_inventory_write();
  if p_id is null then
    insert into public.inventory_categories (name,category_type) values (btrim(p_name),p_type) returning id into v_id;
  else
    update public.inventory_categories set name = btrim(p_name), category_type = p_type
      where id = p_id and updated_at = p_expected returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.save_inventory_item(p_id uuid, p_expected timestamptz, p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_item public.inventory_items;
  v_id uuid;
  v_balance numeric;
begin
  perform public.require_inventory_write();
  if p_id is not null then
    select * into v_item from public.inventory_items where id = p_id and updated_at = p_expected for update;
    if not found then return null; end if;
  end if;

  v_item := jsonb_populate_record(v_item, p_values - 'id' - 'updated_at');
  if v_item.archived_at is not null then
    if p_id is null then raise exception 'A new item must be active'; end if;
    select coalesce(sum(quantity_delta),0) into v_balance from public.inventory_transactions where item_id = p_id;
    if v_balance <> 0 or exists (
      select 1 from public.inventory_issued_lines where item_id = p_id and outstanding > 0 and form_type <> 'RIS'
    ) then raise exception 'Resolve on-hand stock and active custody before archiving'; end if;
  end if;

  if p_id is null then
    insert into public.inventory_items (category_id,item_code,name,unit,unit_cost,reorder_point,condition,description,details)
      values (v_item.category_id,upper(btrim(v_item.item_code)),btrim(v_item.name),btrim(v_item.unit),v_item.unit_cost,
        coalesce(v_item.reorder_point,5),coalesce(v_item.condition,'Serviceable'),coalesce(v_item.description,''),coalesce(v_item.details,'{}'::jsonb))
      returning id into v_id;
  else
    update public.inventory_items set category_id=v_item.category_id,item_code=upper(btrim(v_item.item_code)),
      name=btrim(v_item.name),unit=btrim(v_item.unit),unit_cost=v_item.unit_cost,reorder_point=v_item.reorder_point,
      condition=v_item.condition,description=v_item.description,details=v_item.details,archived_at=v_item.archived_at
      where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.import_inventory_master(p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_id uuid;
  v_quantity numeric;
  v_count integer := 0;
  v_date date := (now() at time zone 'Asia/Manila')::date;
begin
  perform public.require_inventory_write();
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Invalid inventory import'; end if;
  if jsonb_array_length(p_rows) not between 1 and 200 then raise exception 'Import 1 to 200 inventory rows'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := public.save_inventory_item(null,null,v_row - 'opening_quantity');
    v_quantity := coalesce((v_row->>'opening_quantity')::numeric,0);
    if v_quantity is distinct from 0 then
      perform public.post_inventory_document('receipt',v_date,jsonb_build_array(jsonb_build_object('item_id',v_id,'quantity',v_quantity)),null,'Opening inventory import');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.employee_custody_summary(p_employee_id uuid)
returns table (item_name text, item_code text, document_no text, outstanding numeric)
language sql stable security definer set search_path = '' as $$
  select i.name, i.item_code, v.document_no, v.outstanding
  from public.inventory_issued_lines v join public.inventory_items i on i.id = v.item_id
  where v.employee_id = p_employee_id and v.form_type <> 'RIS' and v.outstanding > 0
    and (public.has_permission('inventory.read') or public.has_permission('personnel.read'))
  order by v.document_no, i.item_code;
$$;

create function public.employee_custody_totals()
returns table (employee_id uuid, outstanding numeric)
language sql stable security definer set search_path = '' as $$
  select v.employee_id, sum(v.outstanding)
  from public.inventory_issued_lines v
  where v.form_type <> 'RIS' and v.outstanding > 0
    and (public.has_permission('inventory.read') or public.has_permission('personnel.read'))
  group by v.employee_id;
$$;

revoke all on function public.post_inventory_document(text,date,jsonb,uuid,text,uuid,jsonb),
  public.record_inventory_count(uuid,numeric,date,text,text), public.save_inventory_category(uuid,timestamptz,text,text),
  public.save_inventory_item(uuid,timestamptz,jsonb), public.import_inventory_master(jsonb),
  public.employee_custody_summary(uuid), public.employee_custody_totals() from public, anon;
grant execute on function public.post_inventory_document(text,date,jsonb,uuid,text,uuid,jsonb),
  public.record_inventory_count(uuid,numeric,date,text,text), public.save_inventory_category(uuid,timestamptz,text,text),
  public.save_inventory_item(uuid,timestamptz,jsonb), public.import_inventory_master(jsonb),
  public.employee_custody_summary(uuid), public.employee_custody_totals() to authenticated;
