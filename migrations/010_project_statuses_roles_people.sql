create table if not exists planner_project_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table planner_projects add column if not exists project_status_id uuid;
alter table planner_projects add column if not exists status text default '';

alter table planner_projects
  drop constraint if exists planner_projects_project_status_id_fkey,
  add constraint planner_projects_project_status_id_fkey
  foreign key (project_status_id) references planner_project_statuses(id) on delete set null;

create table if not exists planner_project_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references planner_projects(id) on delete cascade,
  person_id uuid not null references planner_people(id) on delete cascade,
  role_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, person_id)
);

alter table planner_project_statuses enable row level security;
alter table planner_roles enable row level security;
alter table planner_project_people enable row level security;

create index if not exists planner_project_statuses_user_id_idx on planner_project_statuses(user_id);
create index if not exists planner_project_statuses_sort_order_idx on planner_project_statuses(sort_order);
create index if not exists planner_roles_user_id_idx on planner_roles(user_id);
create index if not exists planner_roles_sort_order_idx on planner_roles(sort_order);
create index if not exists planner_projects_project_status_id_idx on planner_projects(project_status_id);
create index if not exists planner_project_people_user_id_idx on planner_project_people(user_id);
create index if not exists planner_project_people_project_id_idx on planner_project_people(project_id);
create index if not exists planner_project_people_person_id_idx on planner_project_people(person_id);
create index if not exists planner_project_people_role_ids_idx on planner_project_people using gin(role_ids);

drop policy if exists "planner_project_statuses_all_for_authenticated_user" on planner_project_statuses;
drop policy if exists "planner_roles_all_for_authenticated_user" on planner_roles;
drop policy if exists "planner_project_people_all_for_authenticated_user" on planner_project_people;

create policy "planner_project_statuses_all_for_authenticated_user"
on planner_project_statuses for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_roles_all_for_authenticated_user"
on planner_roles for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_project_people_all_for_authenticated_user"
on planner_project_people for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
