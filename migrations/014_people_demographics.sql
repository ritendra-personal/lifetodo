alter table planner_people
add column if not exists gender text,
add column if not exists age_band text,
add column if not exists race text;

alter table planner_people
drop constraint if exists planner_people_gender_check,
add constraint planner_people_gender_check
  check (gender is null or gender in ('Male', 'Female'));

alter table planner_people
drop constraint if exists planner_people_age_band_check,
add constraint planner_people_age_band_check
  check (age_band is null or age_band in ('Under 21', '21-35', '35-55', '55+'));

alter table planner_people
drop constraint if exists planner_people_race_check,
add constraint planner_people_race_check
  check (race is null or race in ('Desi', 'White', 'Black', 'Other'));
