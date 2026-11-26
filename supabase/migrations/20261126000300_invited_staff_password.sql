create function public.mark_invitation_password_pending() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.invited_at is not null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"temporary_password": true}'::jsonb;
  end if;
  return new;
end;
$$;
revoke all on function public.mark_invitation_password_pending() from public, anon, authenticated;
create trigger mark_invitation_password_pending before insert on auth.users
  for each row execute function public.mark_invitation_password_pending();
