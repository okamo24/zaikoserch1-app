create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email text null,
  actor_name text null,
  actor_role text null,
  action text not null,
  resource_type text not null,
  resource_id text null,
  resource_label text null,
  status text not null default 'info' check (status in ('info', 'success', 'failure')),
  detail jsonb not null default '{}'::jsonb,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_action_created_at on public.audit_logs(action, created_at desc);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_resource_type_resource_id
  on public.audit_logs(resource_type, resource_id);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using (public.is_admin(auth.uid()));
