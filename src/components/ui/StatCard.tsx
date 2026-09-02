import type { LucideIcon } from 'lucide-react';

export function StatCard({ label, value, detail, icon: Icon, tone = 'gold' }: { label: string; value: string | number; detail: string; icon: LucideIcon; tone?: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><div><p className="eyebrow">{label}</p><strong>{value}</strong><span>{detail}</span></div></div>;
}
