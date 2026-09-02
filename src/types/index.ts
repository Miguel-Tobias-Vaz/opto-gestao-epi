export type Role = 'Administração' | 'Técnico' | 'Visualizador';
export type EmployeeStatus = 'Ativo' | 'Afastado' | 'Desligado';
export type MovementType = 'Entrada' | 'Entrega' | 'Devolução' | 'Perda' | 'Quebra' | 'Ajuste';

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface SystemUser extends AuthUser {
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  initials: string;
  registration: string;
  role: string;
  sector: string;
  admission: string;
  status: EmployeeStatus;
}

export interface Epi {
  id: string;
  name: string;
  category: string;
  brand: string;
  ca: string;
  expiry: string;
  minimum: number;
  available: number;
  inUse: number;
  lost: number;
  broken: number;
}

export interface Movement {
  id: string;
  type: MovementType;
  epiId: string;
  epi: string;
  employeeId: string | null;
  person: string;
  quantity: number;
  date: string;
  note: string;
}

export interface InventoryItem {
  id: string;
  epiId: string;
  epi: string;
  expected: number;
  found: number | null;
  difference: number;
}

export interface InventorySession {
  id: string;
  status: 'Aberto' | 'Concluído';
  startedBy: string;
  createdAt: string;
  closedAt: string | null;
  items: InventoryItem[];
}

export interface DashboardData {
  total: number;
  available: number;
  inUse: number;
  lost: number;
  broken: number;
  pending: number;
  lowStock: Epi[];
  brokenEpis: Epi[];
  recent: Movement[];
  chart: { month: string; value: number }[];
}
