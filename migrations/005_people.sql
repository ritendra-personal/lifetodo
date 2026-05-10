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
  skill_ids uuid[] not null default '{}',
  relationship_type_id uuid references planner_relationship_types(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_skills enable row level security;
alter table planner_relationship_types enable row level security;
alter table planner_people enable row level security;

create index if not exists planner_skills_user_id_idx on planner_skills(user_id);
create index if not exists planner_skills_sort_order_idx on planner_skills(sort_order);
create index if not exists planner_relationship_types_user_id_idx on planner_relationship_types(user_id);
create index if not exists planner_relationship_types_sort_order_idx on planner_relationship_types(sort_order);
create index if not exists planner_people_user_id_idx on planner_people(user_id);
create index if not exists planner_people_skill_ids_idx on planner_people using gin(skill_ids);
create index if not exists planner_people_relationship_type_id_idx on planner_people(relationship_type_id);

drop policy if exists "planner_skills_all_for_authenticated_user" on planner_skills;
drop policy if exists "planner_relationship_types_all_for_authenticated_user" on planner_relationship_types;
drop policy if exists "planner_people_all_for_authenticated_user" on planner_people;

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
