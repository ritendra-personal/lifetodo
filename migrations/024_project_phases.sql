create table if not exists planner_project_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planner_project_phases_user_name_idx
on planner_project_phases (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create index if not exists planner_project_phases_user_id_idx on planner_project_phases(user_id);
create index if not exists planner_project_phases_sort_order_idx on planner_project_phases(sort_order);

create table if not exists planner_project_phase_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references planner_projects(id) on delete cascade,
  phase_id uuid not null references planner_project_phases(id) on delete cascade,
  task_id uuid not null references planner_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, project_id, phase_id, task_id)
);

create index if not exists planner_project_phase_tasks_user_id_idx on planner_project_phase_tasks(user_id);
create index if not exists planner_project_phase_tasks_project_id_idx on planner_project_phase_tasks(project_id);
create index if not exists planner_project_phase_tasks_phase_id_idx on planner_project_phase_tasks(phase_id);
create index if not exists planner_project_phase_tasks_task_id_idx on planner_project_phase_tasks(task_id);

alter table planner_project_phases enable row level security;
alter table planner_project_phase_tasks enable row level security;

drop policy if exists "planner_project_phases_all_for_authenticated_user" on planner_project_phases;
create policy "planner_project_phases_all_for_authenticated_user"
on planner_project_phases for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "planner_project_phase_tasks_all_for_authenticated_user" on planner_project_phase_tasks;
create policy "planner_project_phase_tasks_all_for_authenticated_user"
on planner_project_phase_tasks for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
