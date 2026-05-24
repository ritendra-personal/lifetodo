create table if not exists planner_project_taxonomy_nodes (
  project_id uuid not null references planner_projects(id) on delete cascade,
  taxonomy_node_id uuid not null references planner_taxonomy_nodes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, taxonomy_node_id)
);

alter table planner_project_taxonomy_nodes enable row level security;

create index if not exists planner_project_taxonomy_nodes_user_id_idx on planner_project_taxonomy_nodes(user_id);
create index if not exists planner_project_taxonomy_nodes_project_id_idx on planner_project_taxonomy_nodes(project_id);
create index if not exists planner_project_taxonomy_nodes_taxonomy_node_id_idx on planner_project_taxonomy_nodes(taxonomy_node_id);

drop policy if exists "planner_project_taxonomy_nodes_all_for_authenticated_user" on planner_project_taxonomy_nodes;

create policy "planner_project_taxonomy_nodes_all_for_authenticated_user"
on planner_project_taxonomy_nodes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
