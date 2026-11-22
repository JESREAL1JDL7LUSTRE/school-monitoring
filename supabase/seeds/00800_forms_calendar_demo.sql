-- Synthetic local calendar entries and printable draft snapshots.
do $$
declare
  demo_admin constant uuid := '10000000-0000-4000-8000-000000000001';
  demo_personnel constant uuid := '10000000-0000-4000-8000-000000000003';
  school public.school_settings%rowtype;
  employee public.employees%rowtype;
  template public.form_templates%rowtype;
  as_of date := (now() at time zone 'Asia/Manila')::date;
  issued_on date;
  parameters jsonb;
  sections jsonb;
  detail_fields jsonb;
  detail_values jsonb;
  document_variant integer;
begin
  if not exists (select 1 from auth.users where id = demo_admin and email = 'admin@school.example') then
    raise exception 'Apply the local demo account seed before expanding demo forms and calendar.';
  end if;

  select * into strict school from public.school_settings where id = 1;

  insert into public.calendar_events (id, title, event_date, start_time, notes, created_by)
  select md5('demo-calendar:' || to_char(month_start, 'YYYY-MM') || ':' || event.title)::uuid,
    event.title, month_start::date + event.day_offset, event.start_time, event.notes, demo_personnel
  from generate_series(date_trunc('year', as_of) - interval '1 month', date_trunc('year', as_of) + interval '12 months', interval '1 month') as months(month_start)
  cross join (values
    ('Staff coordination meeting', 3, time '09:00', 'Demo agenda: classroom updates and upcoming school activities.'),
    ('Reading support session', 10, time '14:00', 'Demo literacy activity in the learning resource room.'),
    ('Property and supplies review', 17, time '10:30', 'Demo stock and equipment review with the property custodian.'),
    ('School community activity', 23, null::time, 'Demo campus activity with staff and community volunteers.')
  ) as event(title, day_offset, start_time, notes)
  on conflict do nothing;

  for template in select * from public.form_templates where active and version = 1 order by slug loop
    for document_variant in 1..2 loop
      issued_on := as_of - (2 + document_variant);
      employee := null;
      if template.requires_employee then
        select * into strict employee from public.employees
        where id = md5('demo-personnel:' || (document_variant + 3))::uuid;
        sections := jsonb_build_array(jsonb_build_object('heading', 'Employee details', 'fields', jsonb_build_array(
          jsonb_build_array('Employee', employee.full_name), jsonb_build_array('Employee no.', employee.employee_no),
          jsonb_build_array('Position', employee.position), jsonb_build_array('Employment status', employee.employment_status)
        )));
      else
        sections := '[]'::jsonb;
      end if;

      detail_values := case template.slug
        when 'certificate-of-employment' then '[ ["purpose", "Purpose", "Synthetic employment verification"] ]'::jsonb
        when 'leave-form' then jsonb_build_array(jsonb_build_array('leave_type', 'Type of leave', 'Vacation'),
          jsonb_build_array('from', 'Start date', (as_of + 5)::text), jsonb_build_array('through', 'End date', (as_of + 6)::text),
          jsonb_build_array('work_days', 'Working days requested', '2'), jsonb_build_array('details', 'Leave details', 'Demo scheduled leave'))
        when 'authority-to-travel' then jsonb_build_array(jsonb_build_array('destination', 'Destination', 'Demo district training venue'),
          jsonb_build_array('purpose', 'Purpose', 'Curriculum planning'), jsonb_build_array('from', 'Start date', (as_of + 8)::text),
          jsonb_build_array('through', 'End date', (as_of + 8)::text), jsonb_build_array('funding', 'Funding source', 'Demo school operating fund'))
        when 'locator-slip' then '[ ["destination", "Destination", "Demo schools division office"], ["purpose", "Purpose", "Submit a sample report"], ["depart", "Departure time", "10:00"], ["return_time", "Expected return time", "12:30"] ]'::jsonb
        when 'service-credit' then jsonb_build_array(jsonb_build_array('credit_type', 'Credit requested', 'Service credit'),
          jsonb_build_array('details', 'Service performed', 'Demo reading intervention session'), jsonb_build_array('from', 'Start date', (as_of - 10)::text),
          jsonb_build_array('through', 'End date', (as_of - 10)::text), jsonb_build_array('hours', 'Hours claimed', '4'))
        when 'certificate-of-appearance' then jsonb_build_array(jsonb_build_array('host', 'Office visited', 'Demo district office'),
          jsonb_build_array('appearance_date', 'Appearance date', issued_on::text), jsonb_build_array('purpose', 'Purpose', 'Demo staff orientation'))
        when '4ps-certification' then jsonb_build_array(jsonb_build_array('beneficiary', 'Learner or beneficiary name', 'Synthetic learner ' || document_variant),
          jsonb_build_array('school_year', 'School year', extract(year from as_of)::integer || '–' || (extract(year from as_of)::integer + 1)),
          jsonb_build_array('details', 'Enrollment or attendance details', 'Demo enrollment and classroom attendance record'))
        when 'medical-certificate' then jsonb_build_array(jsonb_build_array('physician', 'Examining physician', 'Demo Examiner'),
          jsonb_build_array('exam_date', 'Examination date', issued_on::text), jsonb_build_array('details', 'Findings', 'Synthetic sample for reviewing this private form layout.'))
        when 'school-level-clearance' then '[ ["purpose", "Purpose", "Demo clearance review"], ["details", "School clearance findings", "Sample files have been checked by the personnel office."] ]'::jsonb
        when 'waiver-of-responsibility' then '[ ["purpose", "Purpose", "Demo off-site training"], ["details", "Scope of waiver", "Sample field exercise for training use only."] ]'::jsonb
        when 'modification-advice' then jsonb_build_array(jsonb_build_array('reference', 'Reference number', 'DEMO-MA-0' || document_variant),
          jsonb_build_array('fund', 'Fund / account', 'Demo operating expense'), jsonb_build_array('amount', 'Amount (PHP)', '12500.00'),
          jsonb_build_array('details', 'Requested modification', 'Move a sample allocation to learning resources.'))
        when 'advice-of-checks-issued' then jsonb_build_array(jsonb_build_array('reference', 'Check number', 'DEMO-CK-0' || document_variant),
          jsonb_build_array('payee', 'Payee', 'Demo School Supplies Cooperative'), jsonb_build_array('bank', 'Bank / account reference', 'Synthetic account 0000'),
          jsonb_build_array('amount', 'Check amount (PHP)', '8350.00'))
        when 'schedule-of-funds' then jsonb_build_array(jsonb_build_array('fund', 'Fund source', 'Demo school operating fund'),
          jsonb_build_array('from', 'Start date', (as_of - 30)::text), jsonb_build_array('through', 'End date', as_of::text),
          jsonb_build_array('amount', 'Amount (PHP)', '25000.00'), jsonb_build_array('details', 'Allocations', 'Learning resources and classroom supplies'))
        when 'transmittal' then jsonb_build_array(jsonb_build_array('recipient', 'Receiving office', 'Demo district records office'),
          jsonb_build_array('reference', 'Reference number', 'DEMO-TRANS-0' || document_variant), jsonb_build_array('details', 'Documents transmitted', 'Synthetic staff summary'))
        when 'district-level-clearance' then '[ ["district", "District", "Demo school district"], ["details", "Clearance findings", "Sample district records clearance."] ]'::jsonb
        when 'pendency' then '[ ["certifying_office", "Certifying office", "Demo administrative office"], ["details", "Case status", "Synthetic record has no pending entry."] ]'::jsonb
        when 'saln' then jsonb_build_array(jsonb_build_array('as_of', 'Statement as of', issued_on::text),
          jsonb_build_array('assets', 'Assets declaration', 'Synthetic assets: 35,000 PHP'), jsonb_build_array('liabilities', 'Liabilities declaration', 'Synthetic liabilities: 2,000 PHP'),
          jsonb_build_array('interests', 'Business interests and financial connections', 'None in this demo example'))
        else '[]'::jsonb
      end;

      select coalesce(jsonb_object_agg(entry->>0, entry->>2), '{}'::jsonb),
        coalesce(jsonb_agg(jsonb_build_array(entry->>1, entry->>2) order by sequence), '[]'::jsonb)
      into parameters, detail_fields
      from jsonb_array_elements(detail_values) with ordinality as details(entry, sequence);

      case template.slug
        when 'service-record' then
          sections := sections || jsonb_build_array(jsonb_build_object('heading', 'Salary and step history', 'table', jsonb_build_object(
            'headers', jsonb_build_array('Effective date', 'Grade / step', 'Monthly salary', 'Reference'),
            'rows', coalesce((select jsonb_agg(jsonb_build_array(to_char(effective_from, 'YYYY-MM-DD'), grade || ' / ' || step, monthly_salary::text || ' PHP', reference_no) order by effective_from desc)
              from public.employee_salary_history where employee_id = employee.id), '[]'::jsonb)
          )));
        when 'employee-201' then
          sections := sections || jsonb_build_array(jsonb_build_object('heading', '201 documents', 'table', jsonb_build_object(
            'headers', jsonb_build_array('Document type', 'Status'),
            'rows', coalesce((select jsonb_agg(jsonb_build_array(t.name, coalesce(d.status, 'Pending')) order by t.sort_order)
              from public.document_types t left join public.employee_documents d on d.document_type_id = t.id and d.employee_id = employee.id where t.active), '[]'::jsonb)
          )));
        when 'nosi' then
          sections := sections || jsonb_build_array(jsonb_build_object('heading', 'Step increment review', 'fields', jsonb_build_array(
            jsonb_build_array('Last step date', employee.initial_step_date::text), jsonb_build_array('Calculated eligibility', (employee.initial_step_date + interval '36 months')::date::text),
            jsonb_build_array('Review status', coalesce((select status from public.nosi_records where employee_id = employee.id order by previous_step_date desc limit 1), 'Not filed'))
          )));
        when 'total-personnel' then
          sections := sections || jsonb_build_array(jsonb_build_object('heading', 'Staff summary', 'table', jsonb_build_object(
            'headers', jsonb_build_array('Employment status', 'Headcount'),
            'rows', (select jsonb_agg(jsonb_build_array(employment_status, headcount::text) order by employment_status)
              from (select employment_status, count(*) as headcount from public.employees where archived_at is null group by employment_status) counts)
          )));
        else null;
      end case;

      if jsonb_array_length(detail_fields) > 0 then
        sections := sections || jsonb_build_array(jsonb_build_object('heading', 'Details', 'fields', detail_fields));
      end if;

      insert into public.generated_documents (id, template_slug, template_version, title, scope, employee_id, generated_by, created_at, snapshot)
      values (md5('demo-draft:' || template.slug || ':' || document_variant)::uuid, template.slug, template.version, template.title,
        template.scope, employee.id, demo_personnel, issued_on::timestamp at time zone 'Asia/Manila', jsonb_build_object(
          'layout', 1, 'school', jsonb_build_object('name', school.school_name, 'division', school.division, 'region', school.region,
            'code', school.school_code, 'logoPath', school.logo_path), 'issuedOn', to_char(issued_on, 'YYYY-MM-DD'),
          'signatories', jsonb_build_array(jsonb_build_array('Prepared by', school.prepared_by), jsonb_build_array('School Head', school.school_head)),
          'parameters', parameters, 'sections', jsonb_build_array(jsonb_build_object('paragraphs', jsonb_build_array('Synthetic training draft for reviewing this form.'))) || sections
        ))
      on conflict do nothing;
    end loop;
  end loop;
end;
$$;
