-- A school-wide read must not let a stock movement cross two contributors' ledgers.
create function public.check_stock_workspace() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not exists (
    select 1 from public.inventory_items where id=new.item_id and owner_id=auth.uid()
  ) then
    raise exception 'Stock movements must belong to the item owner' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.check_stock_workspace() from public,anon,authenticated;
create trigger check_stock_workspace before insert on public.inventory_transactions
  for each row execute function public.check_stock_workspace();
create trigger check_stock_workspace before insert on public.physical_counts
  for each row execute function public.check_stock_workspace();

drop function public.list_staff_roles();
create function public.list_staff_roles()
returns table(email text, roles public.staff_role[], is_super_admin boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.has_permission('settings.write') then raise insufficient_privilege; end if;
  return query select u.email::text,
    coalesce(array_agg(r.role order by r.role) filter(where r.role is not null),'{}'::public.staff_role[]),
    coalesce(bool_or(r.role='admin') and u.raw_app_meta_data->'super_admin'='true'::jsonb,false)
    from auth.users u left join public.staff_roles r on r.user_id=u.id
    where u.email is not null and u.deleted_at is null group by u.id order by u.email;
end $$;
revoke all on function public.list_staff_roles() from public,anon,authenticated;
grant execute on function public.list_staff_roles() to authenticated;
