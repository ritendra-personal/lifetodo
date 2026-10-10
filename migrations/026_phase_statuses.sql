-- Phase statuses are intentionally separate from overall project statuses.
create table if not exists planner_phase_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#667085',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planner_phase_statuses_user_name_idx
on planner_phase_statuses (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
create index if not exists planner_phase_statuses_user_id_idx on planner_phase_statuses(user_id);
create index if not exists planner_phase_statuses_sort_order_idx on planner_phase_statuses(sort_order);

alter table planner_phase_statuses enable row level security;
drop policy if exists "planner_phase_statuses_all_for_authenticated_user" on planner_phase_statuses;
create policy "planner_phase_statuses_all_for_authenticated_user"
on planner_phase_statuses for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into planner_phase_statuses (user_id, name, color, sort_order)
select distinct ps.user_id,
  ps.name,
  case lower(ps.name)
    when 'not started' then '#d85b49'
    when 'in progress' then '#d6a21e'
    when 'completed' then '#2f855a'
    when 'not relevant' then '#667085'
    when 'blocked' then '#7b5ea7'
    else '#667085'
  end,
  ps.sort_order
from planner_project_statuses ps
on conflict do nothing;

alter table planner_project_phase_tasks
  drop constraint if exists planner_project_phase_tasks_status_id_fkey;

update planner_project_phase_tasks link
set status_id = phase_status.id
from planner_project_statuses project_status
join planner_phase_statuses phase_status
  on phase_status.user_id = project_status.user_id
 and lower(phase_status.name) = lower(project_status.name)
where link.status_id = project_status.id;

alter table planner_project_phase_tasks
  add constraint planner_project_phase_tasks_status_id_fkey
  foreign key (status_id) references planner_phase_statuses(id) on delete set null;
