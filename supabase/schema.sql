-- Popote : schéma Supabase
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Peut être relancé sans risque.

-- Foyers : un groupe de personnes qui partagent recettes, planning et courses
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  servings int not null default 4 check (servings > 0),
  time int not null default 0,
  hue int not null default 150,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  nutri jsonb,
  tip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meals (
  household_id uuid not null references public.households on delete cascade,
  day date not null,
  slot text not null check (slot in ('midi', 'soir')),
  recipe_id uuid not null references public.recipes on delete cascade,
  servings int not null default 2 check (servings > 0),
  primary key (household_id, day, slot)
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  aisle text not null default 'Autres',
  qty text,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_checks (
  household_id uuid not null references public.households on delete cascade,
  key text not null,
  primary key (household_id, key)
);

-- Réglages personnels (rééquilibrage alimentaire) : propres à chaque utilisateur
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  diet jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists recipes_household_idx on public.recipes (household_id);
create index if not exists items_household_idx on public.shopping_items (household_id);

-- Appartenance au foyer (security definer pour éviter la récursion des règles RLS)
create or replace function public.is_member(h uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from household_members where household_id = h and user_id = auth.uid())
$$;

create or replace function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'Mon foyer')) returning * into h;
  insert into household_members (household_id, user_id) values (h.id, auth.uid());
  return h;
end $$;

create or replace function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'Code introuvable'; end if;
  insert into household_members (household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;

-- Sécurité : chacun ne voit que les données de son foyer
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.recipes enable row level security;
alter table public.meals enable row level security;
alter table public.shopping_items enable row level security;
alter table public.shopping_checks enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists households_read on public.households;
create policy households_read on public.households for select to authenticated using (is_member(id));
drop policy if exists households_rename on public.households;
create policy households_rename on public.households for update to authenticated using (is_member(id)) with check (is_member(id));

drop policy if exists members_read on public.household_members;
create policy members_read on public.household_members for select to authenticated using (is_member(household_id));
drop policy if exists members_leave on public.household_members;
create policy members_leave on public.household_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists recipes_all on public.recipes;
create policy recipes_all on public.recipes for all to authenticated using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists meals_all on public.meals;
create policy meals_all on public.meals for all to authenticated using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists items_all on public.shopping_items;
create policy items_all on public.shopping_items for all to authenticated using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists checks_all on public.shopping_checks;
create policy checks_all on public.shopping_checks for all to authenticated using (is_member(household_id)) with check (is_member(household_id));
drop policy if exists settings_own on public.user_settings;
create policy settings_own on public.user_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Temps réel : une modification chez l'un apparaît aussitôt chez l'autre
alter table public.recipes replica identity full;
alter table public.meals replica identity full;
alter table public.shopping_items replica identity full;
alter table public.shopping_checks replica identity full;

do $$
declare t text;
begin
  foreach t in array array['recipes', 'meals', 'shopping_items', 'shopping_checks'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
