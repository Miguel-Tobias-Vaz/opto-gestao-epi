import { HttpError } from './http.ts';
import type { AuthUser, EmployeeRow, EpiRow, InventoryItemRow, InventorySessionRow, MovementRow, ProfileRow } from './types.ts';

export function throwDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '23505') {
    if (error.message.includes('email')) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    if (error.message.includes('registration')) throw new HttpError(409, 'Já existe um colaborador com esta matrícula.');
    throw new HttpError(409, 'Este registro já existe.');
  }
  throw new HttpError(400, error.message);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function mapUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    initials: initials(row.name),
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
  };
}

export function publicUser(row: ProfileRow) {
  return {
    id: row.id,
    name: row.name,
    initials: initials(row.name),
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function mapEmployee(row: EmployeeRow) {
  return {
    id: row.id,
    name: row.name,
    initials: initials(row.name),
    registration: row.registration,
    role: row.role,
    sector: row.sector,
    admission: row.admission,
    status: row.status,
  };
}

export function mapEpi(row: EpiRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    brand: row.brand,
    ca: row.ca,
    expiry: row.expiry,
    minimum: row.minimum,
    available: row.available,
    inUse: row.in_use,
    lost: row.lost,
    broken: row.broken,
  };
}

export function mapMovement(row: MovementRow, deliveredBy = '') {
  return {
    id: row.id,
    type: row.type,
    epiId: row.epi_id,
    epi: row.epi_name,
    employeeId: row.employee_id,
    person: row.person_name,
    userId: row.user_id,
    deliveredBy,
    quantity: row.quantity,
    date: row.created_at,
    note: row.note,
  };
}

export function mapInventory(session: InventorySessionRow, items: InventoryItemRow[]) {
  return {
    id: session.id,
    status: session.status,
    startedBy: session.started_by_name,
    createdAt: session.created_at,
    closedAt: session.closed_at,
    items: items.map((item) => ({
      id: item.id,
      epiId: item.epi_id,
      epi: item.epi_name,
      expected: item.expected,
      found: item.found,
      difference: item.difference,
    })),
  };
}
