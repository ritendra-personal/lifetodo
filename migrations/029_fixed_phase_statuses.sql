begin;

-- One-time reset for this account only; never delete phases, projects or tasks.
create table if not exists public.planner_phase_reset_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reset_at timestamptz not null default now()
);
alter table public.planner_phase_reset_log enable row level security;

do $reset$
declare owner_id uuid;
begin
  select id into owner_id from auth.users
  where lower(email) = 'ritendra.datta@gmail.com';
  if owner_id is null then raise exception 'Account not found'; end if;
  if not exists (select 1 from public.planner_phase_reset_log where user_id = owner_id) then
    delete from public.planner_project_phase_tasks where user_id = owner_id;
    delete from public.planner_project_phase_entries where user_id = owner_id;
    delete from public.planner_phase_statuses where user_id = owner_id;
    insert into public.planner_phase_statuses (user_id, name, color, sort_order)
    values
      (owner_id, 'Not started', '#d85b49', 1000),
      (owner_id, 'Blocked', '#7b5ea7', 2000),
      (owner_id, 'Deprioritized', '#667085', 3000),
      (owner_id, 'In progress', '#d6a21e', 4000),
      (owner_id, 'Completed', '#2f855a', 5000),
      (owner_id, 'Not relevant', '#667085', 6000);
    insert into public.planner_phase_reset_log (user_id) values (owner_id);
  end if;
end $reset$;

alter table public.planner_phase_statuses
  drop constraint if exists planner_phase_statuses_fixed_names;
alter table public.planner_phase_statuses
  add constraint planner_phase_statuses_fixed_names
  check (name in ('Not started', 'Blocked', 'Deprioritized', 'In progress', 'Completed', 'Not relevant')) not valid;

create or replace function public.enforce_fixed_phase_status()
returns trigger language plpgsql as $fixed$
begin
  if TG_OP = 'UPDATE' and NEW.name is distinct from OLD.name then
    raise exception 'Phase status names are fixed; only colors can change';
  end if;
  NEW.sort_order := case NEW.name
    when 'Not started' then 1000 when 'Blocked' then 2000
    when 'Deprioritized' then 3000 when 'In progress' then 4000
    when 'Completed' then 5000 when 'Not relevant' then 6000 end;
  return NEW;
end $fixed$;
drop trigger if exists fixed_phase_status on public.planner_phase_statuses;
create trigger fixed_phase_status before insert or update
on public.planner_phase_statuses for each row execute function public.enforce_fixed_phase_status();

drop policy if exists "planner_phase_statuses_all_for_authenticated_user" on public.planner_phase_statuses;
drop policy if exists phase_status_select on public.planner_phase_statuses;
drop policy if exists phase_status_insert on public.planner_phase_statuses;
drop policy if exists phase_status_update on public.planner_phase_statuses;
create policy phase_status_select on public.planner_phase_statuses
for select to authenticated using ((select auth.uid()) = user_id);
create policy phase_status_insert on public.planner_phase_statuses
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy phase_status_update on public.planner_phase_statuses
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
