export function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatFichaDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function todayLabel() {
  return new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

const ROLE_LABELS: Record<string, string> = {
  Administração: 'Administração',
  Gerente: 'Gerente',
  Técnico: 'Técnico de segurança',
  Visualizador: 'Visualizador',
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function isoNextYear() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export type EmployeeHolding = {
  epiId: string;
  name: string;
  category: string;
  ca: string;
  expiry: string;
  quantity: number;
  lastDate: string;
};

export function employeeHoldings(
  employeeId: string,
  movements: import('@/types').Movement[],
  epis: import('@/types').Epi[],
): EmployeeHolding[] {
  const qty = new Map<string, number>();
  const last = new Map<string, string>();
  for (const movement of movements) {
    if (movement.employeeId !== employeeId) continue;
    const delta =
      movement.type === 'Entrega'
        ? movement.quantity
        : movement.type === 'Devolução' || movement.type === 'Perda' || movement.type === 'Quebra'
          ? -movement.quantity
          : 0;
    if (!delta) continue;
    qty.set(movement.epiId, (qty.get(movement.epiId) ?? 0) + delta);
    const previous = last.get(movement.epiId);
    if (!previous || movement.date > previous) last.set(movement.epiId, movement.date);
  }
  return [...qty.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([epiId, quantity]) => {
      const epi = epis.find((item) => item.id === epiId);
      return {
        epiId,
        name: epi?.name ?? 'EPI removido',
        category: epi?.category ?? '—',
        ca: epi?.ca ?? '—',
        expiry: epi?.expiry ?? '',
        quantity,
        lastDate: last.get(epiId) ?? '',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function inferUnit(name: string) {
  return /luva|bota|botina|sapato/i.test(name) ? 'PAR' : 'UN';
}

export type FichaLine = {
  id: string;
  epiId: string;
  epi: string;
  brand: string;
  deliveredBy: string;
  ca: string;
  unit: string;
  quantity: number;
  returnedQuantity: number;
  size: string;
  deliveredAt: string;
  dischargedAt: string | null;
};

export function employeeFichaLines(
  employeeId: string,
  movements: import('@/types').Movement[],
  epis: import('@/types').Epi[],
): FichaLine[] {
  const ofEmployee = movements
    .filter((item) => item.employeeId === employeeId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const returns = ofEmployee
    .filter((item) => item.type === 'Devolução' || item.type === 'Perda' || item.type === 'Quebra')
    .map((item) => ({ epiId: item.epiId, date: item.date, left: item.quantity }));

  const lines: FichaLine[] = [];
  for (const movement of ofEmployee) {
    if (movement.type !== 'Entrega') continue;
    const epi = epis.find((item) => item.id === movement.epiId);
    let remaining = movement.quantity;
    let returnedQuantity = 0;
    let dischargedAt: string | null = null;
    for (const entry of returns) {
      if (entry.epiId !== movement.epiId || entry.left <= 0 || entry.date < movement.date) continue;
      const take = Math.min(remaining, entry.left);
      entry.left -= take;
      remaining -= take;
      returnedQuantity += take;
      dischargedAt = entry.date;
      if (remaining === 0) break;
    }
    lines.push({
      id: movement.id,
      epiId: movement.epiId,
      epi: movement.epi,
      brand: epi?.brand ?? '—',
      deliveredBy: movement.deliveredBy || '—',
      ca: epi?.ca ?? '—',
      unit: inferUnit(epi?.name ?? movement.epi),
      quantity: movement.quantity,
      returnedQuantity,
      size: 'PADRÃO',
      deliveredAt: movement.date,
      dischargedAt: returnedQuantity > 0 ? dischargedAt : null,
    });
  }
  return lines;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
