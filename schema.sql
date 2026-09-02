-- ============================================================
-- Meyaad — expiry tracker — Supabase schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- 1. Organizations (one per signed-up account)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Organization',
  created_at timestamptz default now()
);

-- 2. Link auth.users to an organization
create table org_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz default now()
);

-- 3. Record Types — e.g. "Doctor", "Vehicle", "Guard" (free text, per org)
create table record_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 4. Records — a specific instance within a type, e.g. "Dr. Sharma"
create table records (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references record_types(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 5. Document Categories — e.g. "License", "Certification", within a record
create table document_categories (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references records(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- 6. Documents — the actual dated item
create table documents (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references document_categories(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  expiry_date date, -- null = does not expire
  file_path text,   -- Supabase Storage path, nullable
  created_at timestamptz default now()
);

-- ============================================================
-- Auto-create an organization + membership row when a user signs up
-- (avoids the RLS timing issue PSARA hit — server-side trigger, not client insert)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into organizations (name)
  values (coalesce(new.raw_user_meta_data->>'org_name', 'My Organization'))
  returning id into new_org_id;

  insert into org_members (user_id, org_id)
  values (new.id, new_org_id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security — every table scoped to the caller's org
-- ============================================================
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table record_types enable row level security;
alter table records enable row level security;
alter table document_categories enable row level security;
alter table documents enable row level security;

create or replace function public.current_org_id()
returns uuid
language sql stable
as $$
  select org_id from org_members where user_id = auth.uid()
$$;

create policy "org members can read their org" on organizations
  for select using (id = current_org_id());
create policy "org members can update their org" on organizations
  for update using (id = current_org_id());

create policy "users can read own membership" on org_members
  for select using (user_id = auth.uid());

create policy "org scoped record_types" on record_types
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "org scoped records" on records
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "org scoped document_categories" on document_categories
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "org scoped documents" on documents
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());

-- ============================================================
-- Storage bucket for uploaded document files
-- ============================================================
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "org members can upload their docs"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid() is not null);

create policy "org members can read their docs"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid() is not null);
