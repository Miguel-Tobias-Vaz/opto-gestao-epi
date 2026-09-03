-- Opto Gestão EPI — rode isto no SQL Editor do Supabase (uma vez).
-- Não insere dados de exemplo: o sistema começa vazio.
-- Se a tabela profiles já existir, rode também supabase/add-gerente.sql.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('Administração', 'Gerente', 'Técnico', 'Visualizador')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration text not null unique,
  role text not null,
  sector text not null,
  admission date not null,
  status text not null check (status in ('Ativo', 'Afastado', 'Desligado')),
  created_at timestamptz not null default now()
);

create table if not exists public.epis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  brand text not null,
  ca text not null,
  expiry date not null,
  minimum integer not null default 0 check (minimum >= 0),
  available integer not null default 0 check (available >= 0),
  in_use integer not null default 0 check (in_use >= 0),
  lost integer not null default 0 check (lost >= 0),
  broken integer not null default 0 check (broken >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('Entrada', 'Entrega', 'Devolução', 'Perda', 'Quebra', 'Ajuste')),
  epi_id uuid not null references public.epis(id),
  epi_name text not null,
  employee_id uuid references public.employees(id) on delete set null,
  person_name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  quantity integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('Aberto', 'Concluído')),
  started_by uuid not null references public.profiles(id),
  started_by_name text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  epi_id uuid not null references public.epis(id),
  epi_name text not null,
  expected integer not null,
  found integer,
  difference integer not null default 0
);

create index if not exists idx_movements_created on public.movements (created_at desc);
create index if not exists idx_movements_type on public.movements (type);
create index if not exists idx_employees_name on public.employees (name);

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.epis enable row level security;
alter table public.movements enable row level security;
alter table public.inventory_sessions enable row level security;
alter table public.inventory_items enable row level security;
