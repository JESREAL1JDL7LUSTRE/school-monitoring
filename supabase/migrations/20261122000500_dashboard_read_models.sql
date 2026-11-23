create view public.school_identity with (security_invoker = true) as
  select school_name, region, division from public.school_settings where id = 1;

revoke all on public.school_identity from public, anon, authenticated;
grant select on public.school_identity to authenticated;

create function public.personnel_home_counts()
returns table (as_of date, reporting_year integer, facets jsonb)
language sql stable security invoker set search_path = ''
as $$
  with context as (
    select coalesce(s.reference_date, (now() at time zone 'Asia/Manila')::date) as as_of,
      s.reporting_year, s.step_interval_months, s.retirement_age, s.loyalty_first_years, s.loyalty_interval_years
    from public.school_settings s
    where s.id = 1 and (select public.has_permission('personnel.read'))
  )
  select c.as_of, coalesce(c.reporting_year, extract(year from c.as_of)::integer), coalesce(counts.facets, '{}'::jsonb)
  from context c
  cross join lateral (
    select jsonb_object_agg(filter_key, total) as facets from (
      select filter_key, count(*) as total
      from public.personnel_list_rows(c.as_of, coalesce(c.reporting_year, extract(year from c.as_of)::integer),
        c.step_interval_months, c.retirement_age, c.loyalty_first_years, c.loyalty_interval_years) r
      cross join lateral unnest(r.filter_keys) as keys(filter_key)
      group by filter_key
    ) totals
  ) counts
$$;

revoke all on function public.personnel_home_counts() from public, anon, authenticated;
grant execute on function public.personnel_home_counts() to authenticated;
