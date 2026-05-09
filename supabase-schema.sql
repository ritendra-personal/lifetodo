create extension if not exists pgcrypto;

create table if not exists planner_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  parent_id uuid references planner_tasks(id) on delete cascade,
  title text not null,
  notes text default '',
  tags text[] not null default '{}',
  dependency_ids uuid[] not null default '{}',
  area text not null default 'Life',
  priority text not null default 'Medium',
  status text not null default 'active',
  due_date date,
  energy text not null default 'Medium',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table planner_tasks add column if not exists parent_id uuid references planner_tasks(id) on delete cascade;
alter table planner_tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table planner_tasks add column if not exists tags text[] not null default '{}';
alter table planner_tasks add column if not exists dependency_ids uuid[] not null default '{}';
alter table planner_tasks add column if not exists sort_order numeric not null default 0;

create index if not exists planner_tasks_owner_key_idx on planner_tasks(owner_key);
create index if not exists planner_tasks_user_id_idx on planner_tasks(user_id);
create index if not exists planner_tasks_parent_id_idx on planner_tasks(parent_id);
create index if not exists planner_tasks_tags_idx on planner_tasks using gin(tags);
create index if not exists planner_tasks_dependency_ids_idx on planner_tasks using gin(dependency_ids);
create index if not exists planner_tasks_sort_order_idx on planner_tasks(sort_order);
create index if not exists planner_tasks_due_date_idx on planner_tasks(due_date);
create index if not exists planner_tasks_status_idx on planner_tasks(status);

alter table planner_tasks enable row level security;

drop policy if exists "planner_tasks_select_by_owner_key" on planner_tasks;
drop policy if exists "planner_tasks_insert_by_owner_key" on planner_tasks;
drop policy if exists "planner_tasks_update_by_owner_key" on planner_tasks;
drop policy if exists "planner_tasks_delete_by_owner_key" on planner_tasks;
drop policy if exists "planner_tasks_select_for_publishable_app" on planner_tasks;
drop policy if exists "planner_tasks_insert_for_publishable_app" on planner_tasks;
drop policy if exists "planner_tasks_update_for_publishable_app" on planner_tasks;
drop policy if exists "planner_tasks_delete_for_publishable_app" on planner_tasks;
drop policy if exists "planner_tasks_select_for_authenticated_user" on planner_tasks;
drop policy if exists "planner_tasks_insert_for_authenticated_user" on planner_tasks;
drop policy if exists "planner_tasks_update_for_authenticated_user" on planner_tasks;
drop policy if exists "planner_tasks_delete_for_authenticated_user" on planner_tasks;

create policy "planner_tasks_select_for_authenticated_user"
on planner_tasks for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "planner_tasks_insert_for_authenticated_user"
on planner_tasks for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "planner_tasks_update_for_authenticated_user"
on planner_tasks for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_tasks_delete_for_authenticated_user"
on planner_tasks for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.claim_planner_tasks(legacy_owner_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  if auth.uid() is null or legacy_owner_key is null or length(trim(legacy_owner_key)) < 12 then
    return 0;
  end if;

  update planner_tasks
  set user_id = auth.uid(),
      updated_at = now()
  where owner_key = legacy_owner_key
    and user_id is null;

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_planner_tasks(text) from public;
grant execute on function public.claim_planner_tasks(text) to authenticated;
