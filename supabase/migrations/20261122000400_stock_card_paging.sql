create function public.inventory_stock_card_page(
  p_item uuid, p_date date default null, p_id bigint default null, p_newer boolean default false
)
returns table (
  id text, document_id uuid, document_no text, kind text, transaction_date date,
  quantity_delta numeric, running_balance numeric
)
language sql stable security invoker set search_path = ''
as $$
  select s.id::text, s.document_id, s.document_no, s.kind, s.transaction_date, s.quantity_delta, s.running_balance
  from public.inventory_stock_card s
  where s.item_id = p_item and (p_date is null
    or (p_newer and (s.transaction_date, s.id) > (p_date, p_id))
    or (not p_newer and (s.transaction_date, s.id) < (p_date, p_id)))
  order by
    case when p_newer then s.transaction_date end, case when p_newer then s.id end,
    s.transaction_date desc, s.id desc
  limit 26
$$;

revoke all on function public.inventory_stock_card_page(uuid,date,bigint,boolean) from public, anon, authenticated;
grant execute on function public.inventory_stock_card_page(uuid,date,bigint,boolean) to authenticated;
