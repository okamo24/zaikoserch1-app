alter table public.profiles
add column if not exists approved_at timestamptz null;

alter table public.profiles
add column if not exists deleted_at timestamptz null;

update public.profiles
set approved_at = coalesce(approved_at, updated_at)
where is_approved = true
  and approved_at is null;

create index if not exists idx_profiles_deleted_at on public.profiles(deleted_at);
create index if not exists idx_profiles_approved_at on public.profiles(approved_at);
