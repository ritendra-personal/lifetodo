-- Project phase cells are one editable task checkpoint per project and phase.
alter table planner_project_phase_tasks
  add column if not exists status_id uuid,
  add column if not exists notes text not null default '';

alter table planner_project_phase_tasks
  drop constraint if exists planner_project_phase_tasks_status_id_fkey;

alter table planner_project_phase_tasks
  add constraint planner_project_phase_tasks_status_id_fkey
  foreign key (status_id) references planner_project_statuses(id) on delete set null;

-- Keep one phase entry per project/phase. If older data has duplicate links,
-- retain the first row and remove only the extra links before enforcing it.
delete from planner_project_phase_tasks older
using planner_project_phase_tasks newer
where older.project_id = newer.project_id
  and older.phase_id = newer.phase_id
  and older.ctid > newer.ctid;

create unique index if not exists planner_project_phase_tasks_one_per_cell_idx
on planner_project_phase_tasks (user_id, project_id, phase_id);

create index if not exists planner_project_phase_tasks_status_id_idx
on planner_project_phase_tasks(status_id);
