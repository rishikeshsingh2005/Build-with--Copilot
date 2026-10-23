create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color text not null default '#8268ed' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  subject_id uuid,
  task_type text not null default 'Assignment'
    check (task_type in ('Assignment', 'Project', 'Exam', 'Presentation', 'Study')),
  priority text not null default 'Medium' check (priority in ('High', 'Medium', 'Low')),
  status text not null default 'Pending' check (status in ('Pending', 'In Progress', 'Completed')),
  due_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_subject_owner_fk
    foreign key (subject_id, user_id)
    references public.subjects (id, user_id)
    on delete set null (subject_id)
);

create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists subjects_user_name_idx on public.subjects (user_id, name);

alter table public.subjects enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Students can manage their own subjects" on public.subjects;
create policy "Students can manage their own subjects"
  on public.subjects for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Students can manage their own tasks" on public.tasks;
create policy "Students can manage their own tasks"
  on public.tasks for all
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      subject_id is null
      or exists (
        select 1
        from public.subjects
        where subjects.id = tasks.subject_id
          and subjects.user_id = (select auth.uid())
      )
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();
