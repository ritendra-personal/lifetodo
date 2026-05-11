do $natural_key_guard$
begin
  if exists (
    select 1
    from (
      select user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) as natural_key, count(*) as duplicate_count
      from planner_goals
      group by user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate life goal names exist. Merge or rename duplicate goals before applying migration 011.';
  end if;

  if exists (
    select 1
    from (
      select user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) as natural_key, count(*) as duplicate_count
      from planner_projects
      group by user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate project names exist. Merge or rename duplicate projects before applying migration 011.';
  end if;

  if exists (
    select 1
    from (
      select
        user_id,
        lower(regexp_replace(
          btrim(first_name) ||
            case
              when btrim(coalesce(last_name, '')) = '' then ''
              else ' ' || btrim(coalesce(last_name, ''))
            end,
          '\s+',
          ' ',
          'g'
        )) as natural_key,
        count(*) as duplicate_count
      from planner_people
      group by
        user_id,
        lower(regexp_replace(
          btrim(first_name) ||
            case
              when btrim(coalesce(last_name, '')) = '' then ''
              else ' ' || btrim(coalesce(last_name, ''))
            end,
          '\s+',
          ' ',
          'g'
        ))
      having count(*) > 1
    ) duplicates
  ) then
    raise exception 'Duplicate people names exist. Merge or rename duplicate people before applying migration 011.';
  end if;
end;
$natural_key_guard$;

create unique index if not exists planner_goals_user_name_natural_key_idx
on planner_goals (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

create unique index if not exists planner_projects_user_name_natural_key_idx
on planner_projects (user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

create unique index if not exists planner_people_user_full_name_natural_key_idx
on planner_people (
  user_id,
  lower(regexp_replace(
    btrim(first_name) ||
      case
        when btrim(coalesce(last_name, '')) = '' then ''
        else ' ' || btrim(coalesce(last_name, ''))
      end,
    '\s+',
    ' ',
    'g'
  ))
);
