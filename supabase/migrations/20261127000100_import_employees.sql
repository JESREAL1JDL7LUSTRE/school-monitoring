create function public.import_employees(p_rows jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  entry jsonb;
begin
  if not public.has_permission('personnel.write') then
    raise insufficient_privilege;
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Expected an array of employee rows' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 200 then
    raise exception 'Expected 1 to 200 employee rows' using errcode = '22023';
  end if;
  for entry in select value from jsonb_array_elements(p_rows) loop
    perform public.create_employee(entry->'profile', null, (entry->>'license_expiry')::date);
  end loop;
  return jsonb_array_length(p_rows);
end;
$$;
revoke all on function public.import_employees(jsonb) from public, anon, authenticated;
grant execute on function public.import_employees(jsonb) to authenticated;
