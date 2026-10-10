begin;

create table if not exists public.planner_project_phase_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.planner_projects(id) on delete cascade,
  phase_id uuid not null references public.planner_project_phases(id) on delete cascade,
  status_id uuid references public.planner_phase_statuses(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, phase_id)
);

alter table public.planner_project_phase_entries enable row level security;
drop policy if exists "phase_entries_owner" on public.planner_project_phase_entries;
create policy "phase_entries_owner" on public.planner_project_phase_entries
for all to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.planner_projects p where p.id = project_id and p.user_id = (select auth.uid()))
  and exists (select 1 from public.planner_project_phases p where p.id = phase_id and p.user_id = (select auth.uid()))
  and (status_id is null or exists (select 1 from public.planner_phase_statuses s where s.id = status_id and s.user_id = (select auth.uid())))
);

-- Preserve existing cell status and notes; keep every task and task link.
insert into public.planner_project_phase_entries
  (user_id, project_id, phase_id, status_id, notes, created_at)
select distinct on (user_id, project_id, phase_id)
  user_id, project_id, phase_id, status_id, notes, created_at
from public.planner_project_phase_tasks
order by user_id, project_id, phase_id, created_at, id
on conflict (user_id, project_id, phase_id) do nothing;

drop index if exists public.planner_project_phase_tasks_one_per_cell_idx;

commit;
