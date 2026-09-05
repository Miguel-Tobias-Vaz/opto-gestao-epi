-- Assinaturas da ficha de controle de EPI.
-- SQL Editor do Supabase → cole e rode uma vez.

create table if not exists public.employee_signatures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  movement_id uuid references public.movements(id) on delete cascade,
  kind text not null check (kind in ('termo', 'linha', 'devolucao')),
  image text not null,
  signed_at timestamptz not null default now()
);

create unique index if not exists employee_signatures_termo_uidx
  on public.employee_signatures (employee_id)
  where kind = 'termo';

create unique index if not exists employee_signatures_linha_uidx
  on public.employee_signatures (employee_id, movement_id)
  where kind = 'linha' and movement_id is not null;

create unique index if not exists employee_signatures_devolucao_uidx
  on public.employee_signatures (employee_id, movement_id)
  where kind = 'devolucao' and movement_id is not null;

alter table public.employee_signatures drop constraint if exists employee_signatures_kind_check;
alter table public.employee_signatures add constraint employee_signatures_kind_check check (kind in ('termo', 'linha', 'devolucao'));

alter table public.employee_signatures enable row level security;
