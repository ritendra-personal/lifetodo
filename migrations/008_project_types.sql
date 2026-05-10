create table if not exists planner_project_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table planner_projects add column if not exists project_type_id uuid;

alter table planner_projects
  drop constraint if exists planner_projects_project_type_id_fkey,
  add constraint planner_projects_project_type_id_fkey
  foreign key (project_type_id) references planner_project_types(id) on delete set null;

alter table planner_project_types enable row level security;

create index if not exists planner_project_types_user_id_idx on planner_project_types(user_id);
create index if not exists planner_project_types_sort_order_idx on planner_project_types(sort_order);
create index if not exists planner_projects_project_type_id_idx on planner_projects(project_type_id);

drop policy if exists "planner_project_types_all_for_authenticated_user" on planner_project_types;

create policy "planner_project_types_all_for_authenticated_user"
on planner_project_types for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
