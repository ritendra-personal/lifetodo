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

alter table planner_tasks add column if not exists area_id uuid;
alter table planner_ideas add column if not exists area_id uuid;

alter table planner_tasks
  drop constraint if exists planner_tasks_area_id_fkey,
  add constraint planner_tasks_area_id_fkey
  foreign key (area_id) references planner_areas(id) on delete set null;

alter table planner_ideas
  drop constraint if exists planner_ideas_area_id_fkey,
  add constraint planner_ideas_area_id_fkey
  foreign key (area_id) references planner_areas(id) on delete set null;

alter table planner_areas enable row level security;

create index if not exists planner_tasks_area_id_idx on planner_tasks(area_id);
create index if not exists planner_ideas_area_id_idx on planner_ideas(area_id);
create index if not exists planner_areas_user_id_idx on planner_areas(user_id);
create index if not exists planner_areas_sort_order_idx on planner_areas(sort_order);

drop policy if exists "planner_areas_all_for_authenticated_user" on planner_areas;

create policy "planner_areas_all_for_authenticated_user"
on planner_areas for all
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
