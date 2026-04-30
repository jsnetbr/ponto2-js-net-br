create extension if not exists pgcrypto;

alter table if exists public.profiles
  add column if not exists display_name text;

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.user_settings
  add column if not exists lunch_minutes integer not null default 60;

alter table if exists public.user_settings
  drop constraint if exists user_settings_lunch_minutes_check;

alter table if exists public.user_settings
  add constraint user_settings_lunch_minutes_check check (lunch_minutes between 0 and 1440);

do $$
declare
  v_constraint_name text;
begin
  select conname
  into v_constraint_name
  from pg_constraint
  where conrelid = 'public.punches'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%type in (''in'',''out'')%';

  if v_constraint_name is not null then
    execute format('alter table public.punches drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table if exists public.punches
  drop constraint if exists punches_type_check;

alter table if exists public.punches
  add constraint punches_type_check check (type in ('in','out','lunch_start','lunch_end'));

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

create unique index if not exists punches_user_timestamp_type_unique
  on public.punches(user_id, "timestamp", type);

create index if not exists profiles_email_idx
  on public.profiles(email);

alter table if exists public.profiles enable row level security;
alter table if exists public.user_settings enable row level security;
alter table if exists public.punches enable row level security;

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
