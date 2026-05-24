create table if not exists planner_task_taxonomy_nodes (
  task_id uuid not null references planner_tasks(id) on delete cascade,
  taxonomy_node_id uuid not null references planner_taxonomy_nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, taxonomy_node_id)
);

alter table planner_task_taxonomy_nodes enable row level security;

create index if not exists planner_task_taxonomy_nodes_user_id_idx on planner_task_taxonomy_nodes(user_id);
create index if not exists planner_task_taxonomy_nodes_task_id_idx on planner_task_taxonomy_nodes(task_id);
create index if not exists planner_task_taxonomy_nodes_taxonomy_node_id_idx on planner_task_taxonomy_nodes(taxonomy_node_id);

drop policy if exists "planner_task_taxonomy_nodes_all_for_authenticated_user" on planner_task_taxonomy_nodes;

create policy "planner_task_taxonomy_nodes_all_for_authenticated_user"
on planner_task_taxonomy_nodes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
