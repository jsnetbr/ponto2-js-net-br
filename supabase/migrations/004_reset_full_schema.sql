create extension if not exists pgcrypto;

-- WARNING:
-- This migration is destructive and intended only for disposable environments.
-- For production/staging with existing data, prefer the non-destructive
-- alignment migration (005_non_destructive_schema_alignment.sql).

drop table if exists public.punches cascade;
drop table if exists public.user_settings cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expected_minutes integer not null default 528 check (expected_minutes between 1 and 1440),
  lunch_minutes integer not null default 60 check (lunch_minutes between 0 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.punches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null,
  type text not null check (type in ('in','out','lunch_start','lunch_end')),
  created_at timestamptz not null default now()
);

create index idx_punches_user_timestamp on public.punches(user_id, "timestamp");
create unique index punches_user_timestamp_type_unique on public.punches(user_id, "timestamp", type);
create index profiles_email_idx on public.profiles(email);

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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.punches enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
for all
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings
for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists punches_owner on public.punches;
create policy punches_owner on public.punches
for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
