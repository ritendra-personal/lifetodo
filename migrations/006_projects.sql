create table if not exists planner_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_tasks add column if not exists project_id uuid;

alter table planner_tasks
  drop constraint if exists planner_tasks_project_id_fkey,
  add constraint planner_tasks_project_id_fkey
  foreign key (project_id) references planner_projects(id) on delete set null;

alter table planner_projects enable row level security;

create index if not exists planner_tasks_project_id_idx on planner_tasks(project_id);
create index if not exists planner_projects_user_id_idx on planner_projects(user_id);
create index if not exists planner_projects_target_date_idx on planner_projects(target_date);

drop policy if exists "planner_projects_all_for_authenticated_user" on planner_projects;

create policy "planner_projects_all_for_authenticated_user"
on planner_projects for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
