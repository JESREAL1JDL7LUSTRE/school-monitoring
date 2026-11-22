create function public.audit_log_page(p_at timestamptz default null, p_id bigint default null, p_newer boolean default false)
returns table (id text, user_id uuid, action text, entity_type text, entity_id text, created_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_newer then
    return query select a.id::text, a.user_id, a.action, a.entity_type, a.entity_id, a.created_at
    from public.audit_logs a
    where (a.created_at, a.id) > (p_at, p_id)
    order by a.created_at, a.id limit 26;
  elsif p_at is not null then
    return query select a.id::text, a.user_id, a.action, a.entity_type, a.entity_id, a.created_at
    from public.audit_logs a
    where (a.created_at, a.id) < (p_at, p_id)
    order by a.created_at desc, a.id desc limit 26;
  else
    return query select a.id::text, a.user_id, a.action, a.entity_type, a.entity_id, a.created_at
    from public.audit_logs a order by a.created_at desc, a.id desc limit 26;
  end if;
end;
$$;

revoke all on function public.audit_log_page(timestamptz,bigint,boolean) from public, anon, authenticated;
grant execute on function public.audit_log_page(timestamptz,bigint,boolean) to authenticated;
