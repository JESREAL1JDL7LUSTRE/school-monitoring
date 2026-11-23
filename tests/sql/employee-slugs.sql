\set ON_ERROR_STOP on
begin;

insert into public.employees (employee_no, full_name, position, employment_status, classification)
values
  ('TEST-SLUG-1', U&'Jos\00E9 A. Nu\00F1ez Jr.', 'Test position', 'Permanent', 'NTP'),
  ('TEST-SLUG-2', 'Jose B. Nunez', 'Test position', 'Permanent', 'NTP'),
  ('TEST-SLUG-3', 'New', 'Test position', 'Permanent', 'NTP');

update public.employees set full_name = 'Jose A. Reyes' where employee_no = 'TEST-SLUG-1';

do $$
declare
  slugs text[];
begin
  select array_agg(slug order by employee_no) into slugs
  from public.employees
  where employee_no in ('TEST-SLUG-1', 'TEST-SLUG-2', 'TEST-SLUG-3');
  if slugs is distinct from array['jose-nunez', 'jose-nunez-2', 'new-2'] then
    raise exception 'Unexpected employee slugs: %', slugs;
  end if;
end;
$$;

rollback;
