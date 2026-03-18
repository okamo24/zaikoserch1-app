create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text null,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  imported_at timestamptz not null default timezone('utc', now()),
  stock_date date null,
  stock_csv_filename text not null,
  location_csv_filename text not null,
  stock_csv_count integer not null default 0 check (stock_csv_count >= 0),
  location_csv_count integer not null default 0 check (location_csv_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  message text not null default '',
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  import_log_id uuid not null references public.import_logs(id) on delete cascade,
  product_code text not null default '',
  product_name text not null default '',
  itf text null,
  jan text null,
  stock_qty integer null,
  pack_qty integer null,
  location text null,
  itf_core text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_import_logs_status_imported_at on public.import_logs(status, imported_at desc);
create index if not exists idx_inventory_items_import_log_id on public.inventory_items(import_log_id);
create index if not exists idx_inventory_items_product_code on public.inventory_items(product_code);
create index if not exists idx_inventory_items_itf on public.inventory_items(itf);
create index if not exists idx_inventory_items_jan on public.inventory_items(jan);
create index if not exists idx_inventory_items_itf_core_trgm
  on public.inventory_items using gin (itf_core gin_trgm_ops);
create index if not exists idx_inventory_items_product_name_trgm
  on public.inventory_items using gin (product_name gin_trgm_ops);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists import_logs_set_updated_at on public.import_logs;
create trigger import_logs_set_updated_at
before update on public.import_logs
for each row
execute function public.set_updated_at();

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.search_inventory_items(
  p_query text,
  p_limit integer default 21
)
returns table (
  id uuid,
  import_log_id uuid,
  product_code text,
  product_name text,
  itf text,
  jan text,
  stock_qty integer,
  pack_qty integer,
  location text,
  itf_core text,
  created_at timestamptz,
  stock_date date,
  imported_at timestamptz,
  match_rank integer,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
  with latest_import as (
    select id, stock_date, imported_at
    from public.import_logs
    where status = 'success'
    order by imported_at desc
    limit 1
  ),
  params as (
    select
      trim(coalesce(p_query, '')) as raw_query,
      regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits_query
  ),
  normalized as (
    select
      raw_query,
      digits_query,
      case
        when char_length(digits_query) > 2 then substring(digits_query from 2 for char_length(digits_query) - 2)
        else ''
      end as itf_core_query
    from params
  ),
  scored as (
    select
      i.*,
      l.stock_date,
      l.imported_at,
      case
        when n.digits_query <> '' and i.itf = n.digits_query then 1
        when n.digits_query <> '' and i.jan = n.digits_query then 2
        when n.itf_core_query <> '' and coalesce(i.itf_core, '') ilike '%' || n.itf_core_query || '%' then 3
        when n.digits_query <> '' and i.product_code = n.digits_query then 4
        when n.digits_query <> '' and i.product_code like '%' || n.digits_query || '%' then 5
        when n.raw_query <> '' and i.product_name ilike '%' || n.raw_query || '%' then 6
        else null
      end as match_rank
    from public.inventory_items i
    inner join latest_import l on l.id = i.import_log_id
    cross join normalized n
  )
  select
    scored.id,
    scored.import_log_id,
    scored.product_code,
    scored.product_name,
    scored.itf,
    scored.jan,
    scored.stock_qty,
    scored.pack_qty,
    scored.location,
    scored.itf_core,
    scored.created_at,
    scored.stock_date,
    scored.imported_at,
    scored.match_rank,
    count(*) over() as total_count
  from scored
  where match_rank is not null
  order by match_rank asc, product_code asc
  limit greatest(1, least(p_limit, 50));
$$;

alter table public.profiles enable row level security;
alter table public.import_logs enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin(auth.uid()))
with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "import_logs_select_authenticated" on public.import_logs;
create policy "import_logs_select_authenticated"
on public.import_logs
for select
to authenticated
using (true);

drop policy if exists "inventory_select_authenticated" on public.inventory_items;
create policy "inventory_select_authenticated"
on public.inventory_items
for select
to authenticated
using (true);
