# Life Planner

A dependency-free TODO and life planner web app with localStorage fallback and Supabase-backed persistence for hosted use.

## Features

- Multi-level parent and subtask hierarchies
- Tags for cross-cutting groupings and filters
- Today, Upcoming, Backlog, and Done views
- Task notes, area, priority, due date, and energy fields

## Run Locally

```sh
node server.js
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase-schema.sql`.
3. Add these environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy this folder to Vercel.

The app asks for a private planner key when database mode is enabled. Use a long random phrase and keep it private.
