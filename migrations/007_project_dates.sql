alter table planner_projects add column if not exists start_date date;
alter table planner_projects add column if not exists end_date date;

update planner_projects
set end_date = target_date
where end_date is null
  and target_date is not null;

create index if not exists planner_projects_start_date_idx on planner_projects(start_date);
create index if not exists planner_projects_end_date_idx on planner_projects(end_date);
