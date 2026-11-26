drop trigger mark_invitation_password_pending on auth.users;
create trigger mark_invitation_password_pending before insert or update of invited_at on auth.users
  for each row when (new.invited_at is not null and coalesce(new.encrypted_password, '') = '')
  execute function public.mark_invitation_password_pending();
