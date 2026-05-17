create table if not exists planner_person_private_attributes (
  person_id uuid primary key references planner_people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table planner_person_private_attributes enable row level security;

create index if not exists planner_person_private_attributes_user_id_idx
on planner_person_private_attributes(user_id);

drop policy if exists "planner_person_private_attributes_all_for_authenticated_user"
on planner_person_private_attributes;

create policy "planner_person_private_attributes_all_for_authenticated_user"
on planner_person_private_attributes for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
