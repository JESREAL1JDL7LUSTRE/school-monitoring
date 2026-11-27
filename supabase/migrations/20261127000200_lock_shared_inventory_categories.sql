-- Posting stock takes a share lock on its category. The lock uses UPDATE
-- visibility, while WITH CHECK still controls which rows can be changed.
alter policy update_owner on public.inventory_categories using (
  owner_id = (select auth.uid())
  or (select public.has_permission('super_admin.read'))
  or (
    current_user = 'school_record_operator'
    and owner_id is null
    and id::text ~ '^22000000-0000-4000-8000-0000000000(0[1-9]|1[0-5])$'
  )
);
