insert into public.employees (id, employee_no, full_name, position, classification, employment_status, date_of_birth, date_hired, initial_step_date, checklist_remarks)
values
  ('11111111-1111-4111-8111-111111111111', 'EMP-001', 'Maya H. Rivera', 'Teacher II', 'Teaching', 'Permanent', date '1987-02-18', date '2016-06-01', (current_date - interval '38 months')::date, 'Synthetic checklist fixture'),
  ('11111111-1111-4111-8111-111111111112', 'EMP-002', 'Tomas V. Flores', 'Administrative Assistant II', 'NTP', 'Permanent', (current_date - interval '64 years 6 months')::date, date '1996-06-01', (current_date - interval '35 months')::date, ''),
  ('11111111-1111-4111-8111-111111111113', 'EMP-003', 'Isabel M. Cruz', 'Teacher I', 'Teaching', 'Substitute', date '1997-02-12', (current_date - interval '2 years')::date, null, ''),
  ('11111111-1111-4111-8111-111111111114', 'EMP-004', 'Luis J. Medina', 'Guidance Associate', 'Teaching Related', 'Permanent', date '1980-07-05', date '2011-06-08', (current_date - interval '29 months')::date, ''),
  ('11111111-1111-4111-8111-111111111115', 'EMP-005', 'Lina R. Javier', 'Utility Worker', 'NTP', 'Job Order', date '1990-03-10', (current_date - interval '1 year')::date, null, '');

insert into public.employee_documents (employee_id, document_type_id, status)
values ('11111111-1111-4111-8111-111111111111', 4, 'Complete'),
       ('11111111-1111-4111-8111-111111111111', 13, 'N/A');
insert into public.employee_documents (employee_id, document_type_id, status)
select '11111111-1111-4111-8111-111111111112', id, case when id = 20 then 'N/A' else 'Complete' end
from public.document_types;

insert into public.employee_licenses (employee_id, license_type, license_number, expiry_date)
values ('11111111-1111-4111-8111-111111111111', 'PRC', 'SYNTHETIC-PRC-1', (current_date + interval '20 days')::date),
       ('11111111-1111-4111-8111-111111111113', 'PRC', 'SYNTHETIC-PRC-2', (current_date - interval '1 day')::date);
insert into public.employee_salary_history (employee_id, grade, step, monthly_salary, effective_from, reason)
values ('11111111-1111-4111-8111-111111111111', 13, 4, 35000, date '2019-06-01', 'Synthetic salary reference'),
       ('11111111-1111-4111-8111-111111111111', 13, 5, 39000, (current_date - interval '12 months')::date, 'Synthetic scheduled salary adjustment'),
       ('11111111-1111-4111-8111-111111111112', 8, 3, 20000, date '2021-06-01', 'Synthetic salary reference');
insert into public.nosi_records (employee_id, previous_step_date, eligibility_date, status)
values ('11111111-1111-4111-8111-111111111111', (current_date - interval '38 months')::date,
       ((current_date - interval '38 months') + interval '36 months')::date, 'Submitted to D.O.');
insert into public.concern_logs (employee_id, description, assigned_to, category, priority)
values ('11111111-1111-4111-8111-111111111111', 'Collect the synthetic appointment paper to finish the checklist.', 'Personnel office', '201 Documents', 'High');
