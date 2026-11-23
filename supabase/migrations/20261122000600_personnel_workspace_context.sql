create view public.personnel_reference_context with (security_invoker = true) as
  select dates.as_of, coalesce(s.reporting_year, extract(year from dates.as_of)::integer) as reporting_year,
    s.step_interval_months, s.retirement_age, s.loyalty_first_years, s.loyalty_interval_years,
    s.salary_estimate_percent
  from public.school_settings s
  cross join lateral (select coalesce(s.reference_date, (now() at time zone 'Asia/Manila')::date) as as_of) dates
  where s.id = 1 and (select public.has_permission('personnel.read'));

revoke all on public.personnel_reference_context from public, anon, authenticated;
grant select on public.personnel_reference_context to authenticated;

create or replace function public.personnel_home_counts()
returns table (as_of date, reporting_year integer, facets jsonb)
language sql stable security invoker set search_path = ''
as $$
  select c.as_of, c.reporting_year, coalesce(counts.facets, '{}'::jsonb)
  from public.personnel_reference_context c
  cross join lateral (
    select jsonb_object_agg(filter_key, total) as facets from (
      select filter_key, count(*) as total
      from public.personnel_list_rows(c.as_of, c.reporting_year, c.step_interval_months,
        c.retirement_age, c.loyalty_first_years, c.loyalty_interval_years) r
      cross join lateral unnest(r.filter_keys) as keys(filter_key)
      group by filter_key
    ) totals
  ) counts
$$;

create function public.personnel_workspace_page(p_q text, p_filter text, p_offset int, p_limit int)
returns table (context jsonb, result jsonb)
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
      'asOf', c.as_of, 'reportingYear', c.reporting_year,
      'stepIntervalMonths', c.step_interval_months, 'retirementAge', c.retirement_age,
      'loyaltyFirstYears', c.loyalty_first_years, 'loyaltyIntervalYears', c.loyalty_interval_years,
      'salaryEstimatePercent', c.salary_estimate_percent
    ),
    public.personnel_list_page(c.as_of, c.reporting_year, c.step_interval_months, c.retirement_age,
      c.loyalty_first_years, c.loyalty_interval_years, p_q, p_filter, p_offset, p_limit)
  from public.personnel_reference_context c
$$;

revoke all on function public.personnel_workspace_page(text,text,int,int) from public, anon, authenticated;
grant execute on function public.personnel_workspace_page(text,text,int,int) to authenticated;
