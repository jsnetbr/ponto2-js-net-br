create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expected_minutes integer not null default 528 check (expected_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null,
  type text not null check (type in ('in','out')),
  created_at timestamptz not null default now()
);

create index if not exists idx_punches_user_timestamp on public.punches(user_id, "timestamp");

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.punches enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists punches_owner on public.punches;
create policy punches_owner on public.punches for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
