-- Synthetic local personnel examples. Keep the smaller workflow-test fixtures separate.
do $$
declare
  demo_admin constant uuid := '10000000-0000-4000-8000-000000000001';
  demo_personnel constant uuid := '10000000-0000-4000-8000-000000000003';
  as_of date := (now() at time zone 'Asia/Manila')::date;
  given_names text[] := array[
    'Nadia', 'Nestor', 'Nica', 'Nico', 'Nina', 'Noel', 'Nora', 'Ofelia', 'Olivia',
    'Oscar', 'Paolo', 'Patricia', 'Paula', 'Pedro', 'Pia', 'Rafael', 'Ramon', 'Raul',
    'Reina', 'Ricardo', 'Rita', 'Rodel', 'Rosa', 'Rowena', 'Ruth', 'Samuel', 'Sandra',
    'Sofia', 'Tala', 'Teresa', 'Tomas', 'Valerie', 'Victor', 'Wilma', 'Ysabel', 'Zenaida'
  ];
  surnames text[] := array['Abad', 'Bautista', 'Castillo', 'Delos Reyes', 'Enriquez', 'Garcia', 'Lim', 'Mercado', 'Santos'];
  classifications text[] := array['Teaching', 'Teaching', 'Teaching Related', 'NTP', 'Teaching', 'NTP'];
  positions text[] := array['Teacher I', 'Teacher III', 'Guidance Associate', 'Administrative Assistant II', 'Master Teacher I', 'Records Clerk'];
  concern_categories text[] := array['201 Documents', 'PRC License', 'NOSI', 'Loyalty', 'Retirement', 'Salary', 'Other'];
  concern_details text[] := array[
    'Review the remaining appointment checklist items.', 'Follow up on the professional license renewal.',
    'Review the draft step increment before the next payroll period.', 'Confirm the service dates for the loyalty award.',
    'Prepare the service record for retirement review.', 'Reconcile the salary step with the personnel record.',
    'Schedule a follow-up with the administrative office.'
  ];
  employee uuid;
  hire_date date;
  birth_date date;
  step_date date;
  employee_status text;
  concern_status text;
  position_index integer;
  concern_index integer;
  i integer;
begin
  if not exists (select 1 from auth.users where id = demo_admin and email = 'admin@school.example') then
    raise exception 'Apply the local demo account seed before expanding demo personnel.';
  end if;

  update public.school_settings
  set disbursing_officer = coalesce(nullif(disbursing_officer, ''), 'Demo Disbursing Officer'),
      superintendent = coalesce(nullif(superintendent, ''), 'Demo Superintendent'),
      coa_auditor = coalesce(nullif(coa_auditor, ''), 'Demo Audit Representative')
  where id = 1 and school_code = 'DEMO-001' and school_name = 'Amihan Elementary School'
    and (disbursing_officer = '' or superintendent = '' or coa_auditor = '');

  for i in 1..cardinality(given_names) loop
    employee := md5('demo-personnel:' || i)::uuid;
    position_index := 1 + (i - 1) % cardinality(positions);
    employee_status := case
      when i % 11 = 0 then 'COS'
      when i % 13 = 0 then 'Job Order'
      when i % 7 = 0 then 'Substitute'
      else 'Permanent'
    end;
    if employee_status = 'Job Order' then position_index := 6; end if;
    hire_date := make_date(extract(year from as_of)::integer - case when i % 12 = 0 then 11 else 5 + i % 16 end, 6, 1);
    birth_date := case
      when i = 1 then (as_of - interval '64 years 8 months')::date
      when i = 2 then (as_of - interval '65 years 2 months')::date
      when i = 3 then (as_of - interval '63 years 3 months')::date
      else (as_of - make_interval(years => 33 + i % 25, months => i % 12))::date
    end;
    step_date := case when employee_status = 'Permanent' then (as_of - make_interval(months => 32 + i % 12, days => i % 11))::date end;

    insert into public.employees (
      id, employee_no, full_name, position, classification, employment_status,
      date_of_birth, date_hired, initial_step_date, checklist_review_date, checklist_remarks, archived_at
    ) values (
      employee, 'DEMO-P-' || lpad(i::text, 3, '0'),
      given_names[i] || ' ' || substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1 + i % 26, 1) || '. ' || surnames[1 + (i - 1) % cardinality(surnames)],
      positions[position_index], classifications[position_index], employee_status, birth_date, hire_date, step_date,
      as_of - (i % 16), case when i % 5 = 0 then 'Synthetic checklist review scheduled.' else '' end,
      case when i >= 35 then (as_of - 1)::timestamp at time zone 'Asia/Manila' end
    ) on conflict do nothing;

    if not exists (select 1 from public.employees where id = employee) then continue; end if;

    insert into public.employee_documents (employee_id, document_type_id, status)
    select employee, id, case when (sort_order + i) % 7 = 0 then 'N/A'
      when i % 3 <> 0 and (sort_order + i) % 4 = 0 then 'Pending' else 'Complete' end
    from public.document_types where active
    on conflict do nothing;

    if position_index in (1, 2, 3, 5) then
      insert into public.employee_licenses (id, employee_id, license_type, license_number, expiry_date)
      values (md5('demo-license:' || i)::uuid, employee, 'PRC', 'DEMO-PRC-' || lpad(i::text, 4, '0'),
        as_of + case i % 5 when 0 then -30 when 1 then 18 when 2 then 47 when 3 then 140 else 360 end)
      on conflict do nothing;
    end if;

    insert into public.employee_salary_history (id, employee_id, grade, step, monthly_salary, effective_from, reason, reference_no, recorded_by)
    values
      (md5('demo-salary-start:' || i)::uuid, employee, 7 + position_index, 1, 20000 + position_index * 1800, hire_date,
        'Synthetic appointment salary', 'DEMO-SAL-' || i || '-01', demo_personnel),
      (md5('demo-salary-current:' || i)::uuid, employee, 7 + position_index, 2 + i % 3, 22500 + position_index * 1900 + i * 30,
        coalesce(step_date, (as_of - interval '1 year')::date), 'Synthetic salary step update', 'DEMO-SAL-' || i || '-02', demo_personnel)
    on conflict do nothing;

    if step_date is not null then
      insert into public.nosi_records (id, employee_id, previous_step_date, eligibility_date, status)
      values (md5('demo-nosi:' || i)::uuid, employee, step_date, (step_date + interval '36 months')::date,
        (array['Not filed', 'On-process', 'Submitted to D.O.', 'Adjusted in payslip'])[1 + i % 4])
      on conflict do nothing;
    end if;

    concern_index := 1 + (i - 1) % cardinality(concern_categories);
    concern_status := (array['Open', 'In Progress', 'Resolved', 'Closed'])[1 + i % 4];
    insert into public.concern_logs (id, employee_id, description, assigned_to, category, priority, status, resolved_on, created_at, created_by)
    values (md5('demo-concern:' || i)::uuid, employee, concern_details[concern_index], 'Demo Personnel Office', concern_categories[concern_index],
      (array['Medium', 'High', 'Low', 'Urgent'])[1 + i % 4], concern_status,
      case when concern_status in ('Resolved', 'Closed') then as_of - 1 end,
      (as_of - 2 - i % 20)::timestamp at time zone 'Asia/Manila', demo_personnel)
    on conflict do nothing;
  end loop;
end;
$$;
