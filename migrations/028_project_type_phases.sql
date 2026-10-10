begin;

alter table public.planner_project_phases
  add column if not exists project_type_id uuid
  references public.planner_project_types(id) on delete restrict;

drop index if exists public.planner_project_phases_user_name_idx;
create unique index if not exists planner_project_phases_type_name_idx
on public.planner_project_phases (
  user_id,
  coalesce(project_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
);

-- Give every existing type a copy of the previous shared ordered list.
insert into public.planner_project_phases
  (user_id, project_type_id, name, color, sort_order)
select phase.user_id, type.id, phase.name, phase.color, phase.sort_order
from public.planner_project_phases phase
join public.planner_project_types type on type.user_id = phase.user_id
where phase.project_type_id is null
on conflict do nothing;

-- Move existing cells to their project's type-specific phase.
update public.planner_project_phase_entries entry
set phase_id = replacement.id
from public.planner_projects project,
     public.planner_project_phases original,
     public.planner_project_phases replacement
where entry.project_id = project.id
  and entry.phase_id = original.id
  and original.project_type_id is null
  and replacement.user_id = entry.user_id
  and replacement.project_type_id = project.project_type_id
  and lower(regexp_replace(btrim(replacement.name), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(original.name), '\s+', ' ', 'g'));

update public.planner_project_phase_tasks link
set phase_id = replacement.id
from public.planner_projects project,
     public.planner_project_phases original,
     public.planner_project_phases replacement
where link.project_id = project.id
  and link.phase_id = original.id
  and original.project_type_id is null
  and replacement.user_id = link.user_id
  and replacement.project_type_id = project.project_type_id
  and lower(regexp_replace(btrim(replacement.name), '\s+', ' ', 'g'))
    = lower(regexp_replace(btrim(original.name), '\s+', ' ', 'g'));

commit;
