alter table public.employees add column photo_id uuid;
grant update (photo_id) on public.employees to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-photos', 'employee-photos', false, 4194304, array['image/jpeg','image/png','image/webp']);

create function public.verify_employee_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.photo_id is not distinct from old.photo_id then
    return new;
  end if;
  if old.archived_at is not null or new.archived_at is not null then
    raise exception 'Restore the employee before editing the photo' using errcode = '42501';
  end if;
  if new.photo_id is not null and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'employee-photos'
      and o.name = new.id::text || '/' || new.photo_id::text
      and o.owner_id = (select auth.uid())::text
  ) then
    raise exception 'Employee photo object is missing' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.verify_employee_photo() from public, anon, authenticated;
create trigger verify_employee_photo before update of photo_id on public.employees
  for each row execute function public.verify_employee_photo();

create policy read_employee_photo on storage.objects for select to authenticated using (
  bucket_id = 'employee-photos' and (
    (select public.has_permission('personnel.write'))
    or ((select public.has_permission('personnel.read')) and exists (
      select 1 from public.employees e where storage.objects.name = e.id::text || '/' || e.photo_id::text
    ))
  )
);

create policy upload_employee_photo on storage.objects for insert to authenticated with check (
  bucket_id = 'employee-photos' and (select public.has_permission('personnel.write'))
  and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$'
  and exists (
    select 1 from public.employees e
    where e.id::text = split_part(storage.objects.name, '/', 1) and e.archived_at is null
  )
);

create policy remove_unlinked_employee_photo on storage.objects for delete to authenticated using (
  bucket_id = 'employee-photos' and (select public.has_permission('personnel.write'))
  and not exists (
    select 1 from public.employees e where storage.objects.name = e.id::text || '/' || e.photo_id::text
  )
);
