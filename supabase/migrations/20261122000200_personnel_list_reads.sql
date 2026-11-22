create function public.personnel_list_rows(
  p_as_of date, p_reporting_year int, p_step_months int, p_retirement_age int,
  p_loyalty_first int, p_loyalty_interval int
)
returns table (
  id uuid, full_name text, employee jsonb, checklist_done int, checklist_total int,
  license_expiry date, current_salary jsonb, step_date date,
  nosi_status text, nosi_updated_at timestamptz, nosi_id uuid, custody_quantity numeric, filter_keys text[]
)
language sql stable security invoker set search_path = ''
as $$
  with checklist_type_count as (
    select count(*)::int as total from public.document_types where active
  ), custody as (
    select * from public.employee_custody_totals()
  )
  select e.id, e.full_name, to_jsonb(e), checklist.done, types.total, license.expiry, to_jsonb(salary),
    cycle.step_date, coalesce(nosi.status, 'Not filed'), nosi.updated_at, nosi.id,
    coalesce(custody.outstanding, 0),
    case when e.archived_at is not null then array['archived'] else array_remove(array[
      'all',
      case e.classification when 'Teaching' then 't' when 'Teaching Related' then 'tr' when 'NTP' then 'n' end,
      case e.employment_status when 'Permanent' then 'permanent' when 'Substitute' then 'substitute'
        when 'Job Order' then 'job-order' when 'COS' then 'cos' end,
      case when checklist.done = types.total then 'complete' else 'inc' end,
      case when dates.eligible < p_as_of and dates.step_open then 'over' end,
      case when dates.step_open and dates.eligible between p_as_of and p_as_of + interval '1 month' then 'n1' end,
      case when dates.step_open and dates.eligible between p_as_of and p_as_of + interval '2 months' then 'n2' end,
      case when dates.step_open and dates.eligible between p_as_of and p_as_of + interval '12 months' then 'ny' end,
      case when dates.eligible is not null and not dates.step_open then 'upd' end,
      case when dates.loyalty_start <= p_reporting_year
        and mod(p_reporting_year - dates.loyalty_start, p_loyalty_interval) = 0 then 'l0' end,
      case when dates.loyalty_start <= p_reporting_year + 1
        and mod(p_reporting_year + 1 - dates.loyalty_start, p_loyalty_interval) = 0
        and (dates.loyalty_start > p_reporting_year
          or mod(p_reporting_year - dates.loyalty_start, p_loyalty_interval) <> 0) then 'l1' end,
      case when dates.retirement between p_as_of and p_as_of + interval '1 year' then 'r1' end,
      case when dates.retirement between p_as_of and p_as_of + interval '2 years' then 'r2' end,
      case when dates.retirement between p_as_of and p_as_of + interval '3 years' then 'r3' end,
      case when dates.retirement < p_as_of then 'pr' end,
      case when license.expiry between p_as_of and p_as_of + interval '1 month' then 'c1' end,
      case when license.expiry between p_as_of and p_as_of + interval '2 months' then 'c2' end,
      case when license.expiry < p_as_of then 'exp' end
    ], null) end
  from public.employees e
  cross join checklist_type_count types
  cross join lateral (
    select count(*)::int as done from public.employee_documents d
    join public.document_types t on t.id = d.document_type_id and t.active
    where d.employee_id = e.id and d.status <> 'Pending'
  ) checklist
  cross join lateral (
    select min(l.expiry_date) as expiry from public.employee_licenses l
    where l.employee_id = e.id and l.is_active
  ) license
  left join lateral (
    select s.* from public.employee_salary_history s
    where s.employee_id = e.id and s.effective_from <= p_as_of
    order by s.effective_from desc, s.id limit 1
  ) salary on true
  left join lateral (
    select s.effective_from from public.employee_salary_history s
    where s.employee_id = e.id and s.effective_from <= p_as_of and s.resets_step_date
    order by s.effective_from desc, s.id limit 1
  ) step on true
  cross join lateral (
    select greatest(case when e.initial_step_date <= p_as_of then e.initial_step_date end, step.effective_from) as step_date
  ) cycle
  left join public.nosi_records nosi on nosi.employee_id = e.id and nosi.previous_step_date = cycle.step_date
  left join custody on custody.employee_id = e.id
  cross join lateral (
    select case when e.employment_status = 'Permanent' then
        (cycle.step_date + make_interval(months => p_step_months))::date end as eligible,
      coalesce(nosi.status, 'Not filed') <> 'Adjusted in payslip' as step_open,
      (e.date_of_birth + make_interval(years => p_retirement_age))::date as retirement,
      extract(year from e.date_hired)::int + p_loyalty_first as loyalty_start
  ) dates
$$;

create function public.personnel_list_page(
  p_as_of date, p_reporting_year int, p_step_months int, p_retirement_age int,
  p_loyalty_first int, p_loyalty_interval int,
  p_q text, p_filter text, p_offset int, p_limit int
)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with rows as materialized (
    select * from public.personnel_list_rows(p_as_of, p_reporting_year, p_step_months,
      p_retirement_age, p_loyalty_first, p_loyalty_interval)
  ), matching as materialized (
    select r.* from rows r
    where p_filter = any(r.filter_keys) and (
      p_q = '' or strpos(lower(r.full_name), lower(p_q)) > 0
      or strpos(lower(r.employee ->> 'employee_no'), lower(p_q)) > 0
      or strpos(lower(r.employee ->> 'position'), lower(p_q)) > 0
    )
  ), page_rows as (
    select m.* from matching m order by m.full_name, m.id
    offset greatest(p_offset, 0) limit greatest(1, least(p_limit, 100))
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(p) order by p.full_name, p.id) from page_rows p), '[]'::jsonb),
    'total', (select count(*) from matching),
    'facets', coalesce((select jsonb_object_agg(key, total) from (
      select key, count(*) as total from rows cross join lateral unnest(filter_keys) as keys(key) group by key
    ) counts), '{}'::jsonb)
  )
$$;

revoke all on function public.personnel_list_rows(date,int,int,int,int,int),
  public.personnel_list_page(date,int,int,int,int,int,text,text,int,int) from public, anon, authenticated;
grant execute on function public.personnel_list_rows(date,int,int,int,int,int),
  public.personnel_list_page(date,int,int,int,int,int,text,text,int,int) to authenticated;
