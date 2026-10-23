# TaskFlow — Student Task & Deadline Tracker

TaskFlow is a responsive student productivity app for assignments, projects, exams, presentations, and study tasks. It includes a dashboard, deadline calendar, subject organization, search and filters, progress tracking, reminders, dark mode, and optional Supabase authentication and cloud persistence.

## Run locally

Requirements: Node.js 20+ and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. The app works without backend credentials: its sample tasks and subjects are saved in browser local storage and persist across refreshes on that device.

## Supabase cloud sync and authentication

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). It creates the `tasks` and `subjects` tables, validation constraints, indexes, ownership relationships, update timestamps, and row-level security policies.
3. Copy `.env.example` to `.env` and set:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Restart the development server. Use **Sign in** to create an account or log in. Supabase email confirmation behavior follows your project’s Auth settings.

Only the project URL and publishable/anon key belong in the browser. **Never put a Supabase service-role key in this app or any `VITE_*` variable.** Row-level security ensures signed-in students can only read or modify their own data.

When Supabase credentials are not present, TaskFlow uses local demo mode. Existing local demo data is kept in that browser and is not automatically uploaded when a student later signs in.

## Features

- First-run student welcome page collects university, full name, and ERP/student ID before opening the workspace. With Supabase configured, students can create an account with email/password or sign in; without credentials, they create a local demo profile.
- University, name, and ERP/student ID are saved in Supabase Auth user metadata for signed-in accounts and in this browser for demo profiles.
- Create, edit, inspect, complete, and delete tasks; destructive actions require confirmation.
- Track task type, subject, due date/time, priority, and Pending / In Progress / Completed status.
- Dashboard totals, completion progress, deadline reminders, upcoming deadlines, and recently added tasks.
- All Tasks, Today, Upcoming, Pending, Completed, and Overdue views.
- Search task titles, descriptions, and subjects; filter by status, priority, subject, and due date; sort by due date, priority, or creation date.
- Month calendar, subject management, responsive mobile navigation, light/dark themes, and accessible browser notification opt-in.
- Sample dates are generated relative to the current date.

## Production build

```powershell
npm run build
npm run preview
```

The static production bundle is written to `dist/` and can be deployed to any static host. Configure the two public Supabase environment variables in the hosting provider when cloud sync is enabled.
