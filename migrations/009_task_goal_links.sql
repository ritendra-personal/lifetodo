create table if not exists planner_task_goal_links (
  task_id uuid not null references planner_tasks(id) on delete cascade,
  goal_id uuid not null references planner_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, goal_id)
);

insert into planner_task_goal_links (task_id, goal_id, user_id)
select id, goal_id, user_id
from planner_tasks
where goal_id is not null
  and user_id is not null
on conflict (task_id, goal_id) do nothing;

alter table planner_task_goal_links enable row level security;

create index if not exists planner_task_goal_links_user_id_idx on planner_task_goal_links(user_id);
create index if not exists planner_task_goal_links_goal_id_idx on planner_task_goal_links(goal_id);

drop policy if exists "planner_task_goal_links_all_for_authenticated_user" on planner_task_goal_links;

create policy "planner_task_goal_links_all_for_authenticated_user"
on planner_task_goal_links for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
