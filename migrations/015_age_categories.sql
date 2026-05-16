create table if not exists planner_age_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table planner_people
add column if not exists age_category_id uuid references planner_age_categories(id) on delete set null;

alter table planner_people
drop constraint if exists planner_people_age_band_check;

alter table planner_age_categories enable row level security;

create index if not exists planner_age_categories_user_id_idx on planner_age_categories(user_id);
create index if not exists planner_age_categories_sort_order_idx on planner_age_categories(sort_order);
create index if not exists planner_people_age_category_id_idx on planner_people(age_category_id);

drop policy if exists "planner_age_categories_all_for_authenticated_user" on planner_age_categories;

create policy "planner_age_categories_all_for_authenticated_user"
on planner_age_categories for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
