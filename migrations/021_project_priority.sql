alter table planner_projects add column if not exists project_priority text;

create index if not exists planner_projects_project_priority_idx on planner_projects(project_priority);
