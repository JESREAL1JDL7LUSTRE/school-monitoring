-- Development fixtures only. All accounts and school names are synthetic.
create extension if not exists pgcrypto with schema extensions;

with fixtures(id, email, display_name, staff_role) as (
  values
    ('10000000-0000-4000-8000-000000000001'::uuid, 'admin@school.example', 'Demo Administrator', 'admin'),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'head@school.example', 'Demo School Head', 'school_head'),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'personnel@school.example', 'Demo Personnel Officer', 'administrative_officer'),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'property@school.example', 'Demo Property Custodian', 'property_custodian'),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'auditor@school.example', 'Demo Auditor', 'auditor')
), accounts as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
    email, extensions.crypt('LocalSchoolDesk!2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', display_name),
    now(), now(), '', '', '', '', '', '', '', ''
  from fixtures
  on conflict (id) do nothing
  returning id, email
), identities as (
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  select id, id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email', now(), now(), now()
  from accounts
  on conflict (provider_id, provider) do nothing
)
insert into public.staff_roles (user_id, role)
select id, staff_role::public.staff_role from fixtures
on conflict do nothing;

update public.school_settings set
  school_name = 'Amihan Elementary School',
  division = 'Schools Division Office Albay',
  region = 'Region V (Bicol)',
  school_code = 'DEMO-001',
  school_head = 'Demo School Head',
  administrative_officer = 'Demo Administrative Officer',
  inventory_chair = 'Demo Inventory Chair',
  prepared_by = 'Personnel Office'
where id = 1;
