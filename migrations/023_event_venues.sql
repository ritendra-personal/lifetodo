alter table planner_events
  add column if not exists venue_id uuid references planner_venues(id) on delete set null;

create index if not exists planner_events_venue_id_idx on planner_events(venue_id);
