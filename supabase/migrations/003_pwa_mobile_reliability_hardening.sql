alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

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

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.punches enable row level security;
