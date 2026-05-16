alter table planner_projects add column if not exists project_year integer;

create index if not exists planner_projects_project_year_idx on planner_projects(project_year);
