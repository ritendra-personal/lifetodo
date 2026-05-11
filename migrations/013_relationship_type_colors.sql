alter table planner_relationship_types
add column if not exists color text;

update planner_relationship_types
set color = case lower(name)
  when 'strong' then '#2f855a'
  when 'ok' then '#d6a21e'
  when 'bad' then '#d85b49'
  else coalesce(color, '#111827')
end
where color is null;
