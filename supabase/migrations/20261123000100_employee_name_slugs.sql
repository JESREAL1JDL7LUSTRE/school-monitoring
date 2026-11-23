alter table public.employees add column slug text collate "C";
create unique index employees_slug_key on public.employees (slug);

create function public.assign_employee_slug() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  name_parts text[];
  last_part integer;
  first_name text;
  last_name text;
  base text;
  suffix bigint;
begin
  if tg_op = 'UPDATE' and old.slug is not null then
    new.slug := old.slug;
    return new;
  end if;

  name_parts := regexp_split_to_array(
    btrim(regexp_replace(lower(normalize(new.full_name, NFKD)), U&'[\0300-\036f]', '', 'g'), E' \t\r\n'),
    '[[:space:]]+'
  );
  last_part := cardinality(name_parts);
  if last_part > 2 and rtrim(name_parts[last_part], '.,') in ('jr', 'sr', 'ii', 'iii', 'iv', 'v') then
    last_part := last_part - 1;
  end if;

  first_name := btrim(left(regexp_replace(name_parts[1], '[^a-z0-9]+', '-', 'g'), 40), '-');
  if last_part > 1 then
    last_name := btrim(left(regexp_replace(name_parts[last_part], '[^a-z0-9]+', '-', 'g'), 40), '-');
  end if;
  base := coalesce(nullif(concat_ws('-', nullif(first_name, ''), nullif(last_name, '')), ''), 'employee');
  if base ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
    base := base || '-employee';
  end if;

  -- Serialize allocation so simultaneous creates cannot claim the same slug.
  perform pg_advisory_xact_lock(20261123, 1);
  if base = 'new' or exists (select 1 from public.employees where slug = base) then
    select count(*) + 2
    into suffix
    from public.employees
    where slug like base || '-%' and substr(slug, length(base) + 2) ~ '^[1-9][0-9]*$';
    while exists (select 1 from public.employees where slug = base || '-' || suffix) loop
      suffix := suffix + 1;
    end loop;
    base := base || '-' || suffix;
  end if;
  new.slug := base;
  return new;
end;
$$;

revoke all on function public.assign_employee_slug() from public, anon, authenticated;
create trigger assign_employee_slug before insert or update of slug on public.employees
for each row execute function public.assign_employee_slug();

-- Backfill links without changing the employee records' edit versions or audit history.
alter table public.employees disable trigger touch_updated_at;
alter table public.employees disable trigger audit_changes;
do $$
declare
  employee_id uuid;
begin
  for employee_id in select id from public.employees order by created_at, id loop
    update public.employees set slug = null where id = employee_id;
  end loop;
end;
$$;
alter table public.employees enable trigger touch_updated_at;
alter table public.employees enable trigger audit_changes;

alter table public.employees alter column slug set not null;
