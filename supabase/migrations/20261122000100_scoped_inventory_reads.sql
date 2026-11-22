create view public.inventory_item_stock with (security_invoker = true) as
  select i.*, coalesce(b.balance, 0) as balance, coalesce(b.total_received, 0) as total_received
  from public.inventory_items i
  left join public.inventory_balances b on b.item_id = i.id;

revoke all on public.inventory_item_stock from public, anon, authenticated;
grant select on public.inventory_item_stock to authenticated;

create function public.inventory_item_list(
  p_category uuid default null,
  p_q text default '',
  p_condition text default null,
  p_active boolean default false,
  p_low boolean default false
)
returns setof public.inventory_item_stock
language sql stable security invoker set search_path = ''
as $$
  select i.*
  from public.inventory_item_stock i
  where (i.category_id = p_category or not exists (
    select 1 from public.inventory_categories c where c.id = p_category
  ))
    and (p_q = '' or strpos(lower(i.item_code || ' ' || i.name), lower(p_q)) > 0)
    and (p_condition is null or i.condition = p_condition)
    and (not p_active or i.archived_at is null)
    and (not p_low or (i.archived_at is null and i.balance <= i.reorder_point))
$$;

create function public.recent_inventory_activity(
  p_category uuid default null,
  p_q text default '',
  p_condition text default null,
  p_active boolean default false,
  p_low boolean default false,
  p_item uuid default null
)
returns table (id uuid, document_no text, kind text, transaction_date date, reference text)
language sql stable security invoker set search_path = ''
as $$
  select d.id, d.document_no, d.kind, d.transaction_date, d.reference
  from public.inventory_documents d
  where (p_item is null and p_q = '' and not exists (
      select 1 from public.inventory_categories c where c.id = p_category
    ))
    or exists (
      select 1
      from public.inventory_transactions t
      join public.inventory_item_list(p_category, p_q, p_condition, p_active, p_low) i on i.id = t.item_id
      where t.document_id = d.id and (p_item is null or t.item_id = p_item)
    )
  order by d.created_at desc, d.id desc
  limit 25
$$;

create function public.inventory_counts_as_of(p_through date)
returns setof public.physical_counts
language sql stable security invoker set search_path = ''
as $$
  select distinct on (c.item_id) c.*
  from public.physical_counts c
  where c.count_date <= p_through
  order by c.item_id, c.count_date desc, c.created_at desc, c.id desc
$$;

revoke all on function public.inventory_item_list(uuid,text,text,boolean,boolean),
  public.recent_inventory_activity(uuid,text,text,boolean,boolean,uuid),
  public.inventory_counts_as_of(date) from public, anon, authenticated;
grant execute on function public.inventory_item_list(uuid,text,text,boolean,boolean),
  public.recent_inventory_activity(uuid,text,text,boolean,boolean,uuid),
  public.inventory_counts_as_of(date) to authenticated;
