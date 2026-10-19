begin;

create table if not exists public.planner_person_private_attributes (
  person_id uuid primary key references public.planner_people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_person_private_attributes enable row level security;
create index if not exists planner_person_private_attributes_user_id_idx
  on public.planner_person_private_attributes(user_id);

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'planner_person_private_attributes'
      and policyname = 'planner_person_private_attributes_all_for_authenticated_user'
  ) then
    create policy planner_person_private_attributes_all_for_authenticated_user
      on public.planner_person_private_attributes for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $policy$;

grant select, insert, update, delete
  on public.planner_person_private_attributes to authenticated;
notify pgrst, 'reload schema';
commit;
