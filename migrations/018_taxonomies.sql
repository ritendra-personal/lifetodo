create extension if not exists pgcrypto;

create table if not exists planner_taxonomies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists planner_taxonomy_nodes (
  id uuid primary key default gen_random_uuid(),
  taxonomy_id uuid not null references planner_taxonomies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table planner_taxonomies enable row level security;
alter table planner_taxonomy_nodes enable row level security;

create index if not exists planner_taxonomies_user_id_idx on planner_taxonomies(user_id);
create index if not exists planner_taxonomy_nodes_user_id_idx on planner_taxonomy_nodes(user_id);
create index if not exists planner_taxonomy_nodes_taxonomy_id_idx on planner_taxonomy_nodes(taxonomy_id);
create index if not exists planner_taxonomy_nodes_parent_id_idx on planner_taxonomy_nodes(parent_id);
create index if not exists planner_taxonomy_nodes_sort_order_idx on planner_taxonomy_nodes(sort_order);

drop policy if exists "planner_taxonomies_all_for_authenticated_user" on planner_taxonomies;
drop policy if exists "planner_taxonomy_nodes_all_for_authenticated_user" on planner_taxonomy_nodes;

create policy "planner_taxonomies_all_for_authenticated_user"
on planner_taxonomies for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "planner_taxonomy_nodes_all_for_authenticated_user"
on planner_taxonomy_nodes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

do $$
declare
  target_user_id uuid;
  v_taxonomy_id uuid;
  root_id uuid;
begin
  select id into target_user_id
  from auth.users
  where email = 'ritendra.datta@gmail.com'
  limit 1;

  if target_user_id is null then
    raise notice 'Skipping Life areas taxonomy seed because ritendra.datta@gmail.com was not found.';
    return;
  end if;

  insert into planner_taxonomies (user_id, name)
  values (target_user_id, 'Life areas')
  on conflict (user_id, name) do update
    set updated_at = now()
  returning id into v_taxonomy_id;

  if exists (
    select 1
    from planner_taxonomy_nodes
    where user_id = target_user_id
      and taxonomy_id = v_taxonomy_id
  ) then
    return;
  end if;

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Work', 1000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Projects', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Meetings', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Follow-ups', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Deadlines', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Decisions', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Learning', 6000),
    (v_taxonomy_id, target_user_id, root_id, 'Career growth', 7000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Home', 2000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Cleaning', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Repairs', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Organization', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Supplies', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Mail', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Utilities', 6000),
    (v_taxonomy_id, target_user_id, root_id, 'Maintenance', 7000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Health', 3000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Sleep', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Exercise', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Food', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Appointments', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Mental health', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Energy management', 6000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Money', 4000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Bills', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Taxes', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Budgeting', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Investments', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Insurance', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Subscriptions', 6000),
    (v_taxonomy_id, target_user_id, root_id, 'Purchases', 7000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'People', 5000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Family', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Friends', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Relationships', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Networking', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Social plans', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Important conversations', 6000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Creative / Personal Projects', 6000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Ideas', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Ongoing projects', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Research', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Writing', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Music / art', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Side projects', 6000),
    (v_taxonomy_id, target_user_id, root_id, 'Long-term ambitions', 7000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Digital Life', 7000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Email', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Files', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Photos', 3000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Devices', 8000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Accounts/passwords', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Backups', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Software/tools', 3000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Errands / Logistics', 9000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Shopping', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Returns', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Travel', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Vehicle', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Scheduling', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Appointments', 6000),
    (v_taxonomy_id, target_user_id, root_id, 'Forms/paperwork', 7000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Open Loops', 10000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Waiting on others', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Decisions to make', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Unfinished tasks', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Unclear situations', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Things bothering you', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Things repeatedly on your mind', 6000);

  insert into planner_taxonomy_nodes (id, taxonomy_id, user_id, parent_id, name, sort_order)
  values (gen_random_uuid(), v_taxonomy_id, target_user_id, null, 'Someday / Maybe', 11000)
  returning id into root_id;
  insert into planner_taxonomy_nodes (taxonomy_id, user_id, parent_id, name, sort_order) values
    (v_taxonomy_id, target_user_id, root_id, 'Future goals', 1000),
    (v_taxonomy_id, target_user_id, root_id, 'Travel ideas', 2000),
    (v_taxonomy_id, target_user_id, root_id, 'Skills to learn', 3000),
    (v_taxonomy_id, target_user_id, root_id, 'Possible purchases', 4000),
    (v_taxonomy_id, target_user_id, root_id, 'Dream projects', 5000),
    (v_taxonomy_id, target_user_id, root_id, 'Interesting ideas', 6000);
end $$;
