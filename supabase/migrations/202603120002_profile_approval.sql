alter table public.profiles
add column if not exists is_approved boolean not null default false;

update public.profiles
set is_approved = true
where role = 'admin';

create index if not exists idx_profiles_is_approved on public.profiles(is_approved);
