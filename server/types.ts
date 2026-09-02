export const ROLES = ['Administração', 'Técnico', 'Visualizador'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYEE_STATUSES = ['Ativo', 'Afastado', 'Desligado'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const MOVEMENT_TYPES = ['Entrada', 'Entrega', 'Devolução', 'Perda', 'Quebra', 'Ajuste'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export type AuthUser = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  active: boolean;
};

export type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
};

export type EmployeeRow = {
  id: string;
  name: string;
  registration: string;
  role: string;
  sector: string;
  admission: string;
  status: EmployeeStatus;
  created_at: string;
};

export type EpiRow = {
  id: string;
  name: string;
  category: string;
  brand: string;
  ca: string;
  expiry: string;
  minimum: number;
  available: number;
  in_use: number;
  lost: number;
  broken: number;
  created_at: string;
};

export type MovementRow = {
  id: string;
  type: MovementType;
  epi_id: string;
  epi_name: string;
  employee_id: string | null;
  person_name: string;
  user_id: string | null;
  quantity: number;
  note: string;
  created_at: string;
};

export type InventorySessionRow = {
  id: string;
  status: 'Aberto' | 'Concluído';
  started_by: string;
  started_by_name: string;
  created_at: string;
  closed_at: string | null;
};

export type InventoryItemRow = {
  id: string;
  session_id: string;
  epi_id: string;
  epi_name: string;
  expected: number;
  found: number | null;
  difference: number;
};
