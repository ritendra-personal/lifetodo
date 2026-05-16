create extension if not exists pgcrypto;

create table if not exists planner_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  goal_id uuid,
  project_id uuid,
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
alter table planner_tasks add column if not exists goal_id uuid;
alter table planner_tasks add column if not exists project_id uuid;
alter table planner_tasks add column if not exists area_id uuid;
alter table planner_tasks add column if not exists tags text[] not null default '{}';
alter table planner_tasks add column if not exists dependency_ids uuid[] not null default '{}';
alter table planner_tasks add column if not exists sort_order numeric not null default 0;

create index if not exists planner_tasks_owner_key_idx on planner_tasks(owner_key);
create index if not exists planner_tasks_user_id_idx on planner_tasks(user_id);
create index if not exists planner_tasks_goal_id_idx on planner_tasks(goal_id);
create index if not exists planner_tasks_project_id_idx on planner_tasks(project_id);
create index if not exists planner_tasks_area_id_idx on planner_tasks(area_id);
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

create table if not exists planner_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planner_task_goal_links (
  task_id uuid not null references planner_tasks(id) on delete cascade,
  goal_id uuid not null references planner_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, goal_id)
);

create table if not exists planner_project_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

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

create table if not exists planner_venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  project_type_id uuid,
  project_status_id uuid,
  venue_id uuid,
  project_year integer,
  status text default '',
  start_date date,
  end_date date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_projects add column if not exists start_date date;
alter table planner_projects add column if not exists end_date date;
alter table planner_projects add column if not exists project_type_id uuid;
alter table planner_projects add column if not exists project_status_id uuid;
alter table planner_projects add column if not exists venue_id uuid;
alter table planner_projects add column if not exists project_year integer;
alter table planner_projects add column if not exists status text default '';

create table if not exists planner_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  area_id uuid,
  area text not null default 'Life',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_ideas add column if not exists area_id uuid;

alter table planner_tasks
  drop constraint if exists planner_tasks_project_id_fkey,
  add constraint planner_tasks_project_id_fkey
  foreign key (project_id) references planner_projects(id) on delete set null;

alter table planner_projects
  drop constraint if exists planner_projects_project_type_id_fkey,
  add constraint planner_projects_project_type_id_fkey
  foreign key (project_type_id) references planner_project_types(id) on delete set null;

alter table planner_projects
  drop constraint if exists planner_projects_project_status_id_fkey,
  add constraint planner_projects_project_status_id_fkey
  foreign key (project_status_id) references planner_project_statuses(id) on delete set null;

alter table planner_projects
  drop constraint if exists planner_projects_venue_id_fkey,
  add constraint planner_projects_venue_id_fkey
  foreign key (venue_id) references planner_venues(id) on delete set null;

create table if not exists planner_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#667085',
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_relationship_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table planner_relationship_types
add column if not exists color text;

create table if not exists planner_age_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text default '',
  gender text,
  age_category_id uuid references planner_age_categories(id) on delete set null,
  age_band text,
  race text,
  skill_ids uuid[] not null default '{}',
  relationship_type_id uuid references planner_relationship_types(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_people
add column if not exists gender text,
add column if not exists age_category_id uuid references planner_age_categories(id) on delete set null,
add column if not exists age_band text,
add column if not exists race text;

alter table planner_people
drop constraint if exists planner_people_gender_check,
add constraint planner_people_gender_check
  check (gender is null or gender in ('Male', 'Female'));

alter table planner_people
drop constraint if exists planner_people_age_band_check;

alter table planner_people
drop constraint if exists planner_people_race_check,
add constraint planner_people_race_check
  check (race is null or race in ('Desi', 'White', 'Black', 'Other'));

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

alter table planner_tasks
  drop constraint if exists planner_tasks_area_id_fkey,
  add constraint planner_tasks_area_id_fkey
  foreign key (area_id) references planner_areas(id) on delete set null;

alter table planner_ideas
  drop constraint if exists planner_ideas_area_id_fkey,
  add constraint planner_ideas_area_id_fkey
  foreign key (area_id) references planner_areas(id) on delete set null;

alter table planner_goals enable row level security;
alter table planner_task_goal_links enable row level security;
alter table planner_project_types enable row level security;
alter table planner_project_statuses enable row level security;
alter table planner_roles enable row level security;
alter table planner_venues enable row level security;
alter table planner_age_categories enable row level security;
alter table planner_projects enable row level security;
alter table planner_project_people enable row level security;
alter table planner_ideas enable row level security;
alter table planner_areas enable row level security;
alter table planner_skills enable row level security;
alter table planner_relationship_types enable row level security;
alter table planner_people enable row level security;

create index if not exists planner_goals_user_id_idx on planner_goals(user_id);
create unique index if not exists planner_goals_user_name_natural_key_idx
on planner_goals (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create index if not exists planner_task_goal_links_user_id_idx on planner_task_goal_links(user_id);
create index if not exists planner_task_goal_links_goal_id_idx on planner_task_goal_links(goal_id);
create index if not exists planner_project_types_user_id_idx on planner_project_types(user_id);
create index if not exists planner_project_types_sort_order_idx on planner_project_types(sort_order);
create index if not exists planner_project_statuses_user_id_idx on planner_project_statuses(user_id);
create index if not exists planner_project_statuses_sort_order_idx on planner_project_statuses(sort_order);
create index if not exists planner_roles_user_id_idx on planner_roles(user_id);
create index if not exists planner_roles_sort_order_idx on planner_roles(sort_order);
create index if not exists planner_venues_user_id_idx on planner_venues(user_id);
create index if not exists planner_venues_sort_order_idx on planner_venues(sort_order);
create index if not exists planner_age_categories_user_id_idx on planner_age_categories(user_id);
create index if not exists planner_age_categories_sort_order_idx on planner_age_categories(sort_order);
create index if not exists planner_projects_user_id_idx on planner_projects(user_id);
create unique index if not exists planner_projects_user_name_natural_key_idx
on planner_projects (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create index if not exists planner_projects_project_type_id_idx on planner_projects(project_type_id);
create index if not exists planner_projects_project_status_id_idx on planner_projects(project_status_id);
create index if not exists planner_projects_venue_id_idx on planner_projects(venue_id);
create index if not exists planner_projects_project_year_idx on planner_projects(project_year);
create index if not exists planner_projects_start_date_idx on planner_projects(start_date);
create index if not exists planner_projects_end_date_idx on planner_projects(end_date);
create index if not exists planner_projects_target_date_idx on planner_projects(target_date);
create index if not exists planner_ideas_user_id_idx on planner_ideas(user_id);
create index if not exists planner_ideas_area_id_idx on planner_ideas(area_id);
create index if not exists planner_areas_user_id_idx on planner_areas(user_id);
create index if not exists planner_areas_sort_order_idx on planner_areas(sort_order);
create index if not exists planner_skills_user_id_idx on planner_skills(user_id);
create index if not exists planner_skills_sort_order_idx on planner_skills(sort_order);
create index if not exists planner_relationship_types_user_id_idx on planner_relationship_types(user_id);
create index if not exists planner_relationship_types_sort_order_idx on planner_relationship_types(sort_order);
create index if not exists planner_people_user_id_idx on planner_people(user_id);
create unique index if not exists planner_people_user_full_name_natural_key_idx
on planner_people (
  user_id,
  lower(regexp_replace(
    btrim(first_name) ||
      case
        when btrim(coalesce(last_name, '')) = '' then ''
        else ' ' || btrim(coalesce(last_name, ''))
      end,
    '\s+',
    ' ',
    'g'
  ))
);
create index if not exists planner_people_skill_ids_idx on planner_people using gin(skill_ids);
create index if not exists planner_people_age_category_id_idx on planner_people(age_category_id);
create index if not exists planner_people_relationship_type_id_idx on planner_people(relationship_type_id);
create index if not exists planner_project_people_user_id_idx on planner_project_people(user_id);
create index if not exists planner_project_people_project_id_idx on planner_project_people(project_id);
create index if not exists planner_project_people_person_id_idx on planner_project_people(person_id);
create index if not exists planner_project_people_role_ids_idx on planner_project_people using gin(role_ids);

drop policy if exists "planner_goals_all_for_authenticated_user" on planner_goals;
drop policy if exists "planner_task_goal_links_all_for_authenticated_user" on planner_task_goal_links;
drop policy if exists "planner_project_types_all_for_authenticated_user" on planner_project_types;
drop policy if exists "planner_project_statuses_all_for_authenticated_user" on planner_project_statuses;
drop policy if exists "planner_roles_all_for_authenticated_user" on planner_roles;
drop policy if exists "planner_venues_all_for_authenticated_user" on planner_venues;
drop policy if exists "planner_age_categories_all_for_authenticated_user" on planner_age_categories;
drop policy if exists "planner_projects_all_for_authenticated_user" on planner_projects;
drop policy if exists "planner_project_people_all_for_authenticated_user" on planner_project_people;
drop policy if exists "planner_ideas_all_for_authenticated_user" on planner_ideas;
drop policy if exists "planner_areas_all_for_authenticated_user" on planner_areas;
drop policy if exists "planner_skills_all_for_authenticated_user" on planner_skills;
drop policy if exists "planner_relationship_types_all_for_authenticated_user" on planner_relationship_types;
drop policy if exists "planner_people_all_for_authenticated_user" on planner_people;

create policy "planner_goals_all_for_authenticated_user"
on planner_goals for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_task_goal_links_all_for_authenticated_user"
on planner_task_goal_links for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_project_types_all_for_authenticated_user"
on planner_project_types for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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

create policy "planner_venues_all_for_authenticated_user"
on planner_venues for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_age_categories_all_for_authenticated_user"
on planner_age_categories for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_projects_all_for_authenticated_user"
on planner_projects for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_project_people_all_for_authenticated_user"
on planner_project_people for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_ideas_all_for_authenticated_user"
on planner_ideas for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_areas_all_for_authenticated_user"
on planner_areas for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_skills_all_for_authenticated_user"
on planner_skills for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_relationship_types_all_for_authenticated_user"
on planner_relationship_types for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_people_all_for_authenticated_user"
on planner_people for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

update planner_tasks t
set area_id = a.id
from planner_areas a
where t.user_id = a.user_id
  and t.area = a.name
  and t.area_id is null;

update planner_ideas i
set area_id = a.id
from planner_areas a
where i.user_id = a.user_id
  and i.area = a.name
  and i.area_id is null;
