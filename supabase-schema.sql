create extension if not exists pgcrypto;

create table if not exists planner_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  parent_id uuid references planner_tasks(id) on delete cascade,
  title text not null,
  notes text default '',
  tags text[] not null default '{}',
  area text not null default 'Life',
  priority text not null default 'Medium',
  status text not null default 'active',
  due_date date,
  energy text not null default 'Medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table planner_tasks add column if not exists parent_id uuid references planner_tasks(id) on delete cascade;
alter table planner_tasks add column if not exists tags text[] not null default '{}';

create index if not exists planner_tasks_owner_key_idx on planner_tasks(owner_key);
create index if not exists planner_tasks_parent_id_idx on planner_tasks(parent_id);
create index if not exists planner_tasks_tags_idx on planner_tasks using gin(tags);
create index if not exists planner_tasks_due_date_idx on planner_tasks(due_date);
create index if not exists planner_tasks_status_idx on planner_tasks(status);

alter table planner_tasks enable row level security;

create policy "planner_tasks_select_by_owner_key"
on planner_tasks for select
to anon
using (owner_key = current_setting('request.headers', true)::json->>'x-planner-key');

create policy "planner_tasks_insert_by_owner_key"
on planner_tasks for insert
to anon
with check (owner_key = current_setting('request.headers', true)::json->>'x-planner-key');

create policy "planner_tasks_update_by_owner_key"
on planner_tasks for update
to anon
using (owner_key = current_setting('request.headers', true)::json->>'x-planner-key')
with check (owner_key = current_setting('request.headers', true)::json->>'x-planner-key');

create policy "planner_tasks_delete_by_owner_key"
on planner_tasks for delete
to anon
using (owner_key = current_setting('request.headers', true)::json->>'x-planner-key');
