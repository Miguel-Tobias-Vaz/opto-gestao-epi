import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  FileText,
  HardHat,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  UserCog,
  Users,
  Warehouse,
  X,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ShaderHero } from '@/components/ui/shader-hero';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Footer } from '@/components/ui/footer';
import { Modal, Table } from '@/components/ui/Modal';
import { api, ApiError } from '@/lib/api';
import { downloadCsv, firstName, formatDate, formatDateTime, greeting, isoNextYear, isoToday, roleLabel, todayLabel } from '@/lib/format';
import type { AuthUser, DashboardData, Employee, EmployeeStatus, Epi, InventorySession, Movement, MovementType, Role, SystemUser } from '@/types';

type Page = 'Dashboard' | 'Funcionários' | 'EPIs' | 'Estoque' | 'Movimentações' | 'Inventário' | 'Relatórios' | 'Contratos' | 'Usuários' | 'Configurações';

const nav: { label: Page; icon: typeof LayoutDashboard; adminOnly?: boolean }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Funcionários', icon: Users },
  { label: 'EPIs', icon: HardHat },
  { label: 'Estoque', icon: Warehouse },
  { label: 'Movimentações', icon: Activity },
  { label: 'Inventário', icon: ClipboardCheck },
  { label: 'Contratos', icon: FileSearch },
  { label: 'Relatórios', icon: BarChart3 },
  { label: 'Usuários', icon: UserCog, adminOnly: true },
  { label: 'Configurações', icon: Settings },
];

const emptyUserForm = { name: '', email: '', password: '', role: 'Técnico' as Role };

function RoleSelect({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as Role)}>
      <option value="Administração">Administração</option>
      <option value="Técnico">Técnico de segurança</option>
      <option value="Visualizador">Visualizador</option>
    </select>
  );
}

type ContractStatus = 'Aguardando' | 'Extraindo' | 'Concluído';
type Contract = { id: string; name: string; status: ContractStatus; confidence: number; supplier: string; value: string; expires: string; pages: number };

const contractFields = (name: string) => ({
  supplier: name.replace(/\.[^/.]+$/, '').split(/[-_]/)[0] || 'Fornecedor identificado',
  value: 'R$ 48.750,00',
  expires: '31/12/2026',
  pages: 8,
});

function recoveryFromUrl() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const type = hash.get('type') ?? query.get('type');
  const accessToken = hash.get('access_token') ?? query.get('access_token');
  const refreshToken = hash.get('refresh_token') ?? query.get('refresh_token');
  if (type === 'recovery' && accessToken && refreshToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

function Login({ onEnter }: { onEnter: (user: AuthUser) => void }) {
  const recovery = recoveryFromUrl();
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>(recovery ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const title = view === 'forgot' ? 'Redefinir senha' : view === 'reset' ? 'Nova senha' : 'Acessar sistema';

  return (
    <main className="login-screen">
      <ShaderHero />
      <div className="login-copy">
        <motion.div className="login-mark" aria-hidden="true" animate={{ y: [0, -10, 0], rotate: [0, 1, 0, -1, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}>
          <img src="/logo/OPTO%20-%20Azul.png" alt="Opto Gestão EPI" />
        </motion.div>
        <p className="kicker">OPTO GESTÃO EPI / OPERAÇÕES</p>
        <h1>Segurança sob controle.</h1>
        <p>Rastreabilidade clara para cada equipamento, cada pessoa e cada decisão.</p>
      </div>
      <form
        className="login-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          setInfo('');
          try {
            if (view === 'forgot') {
              await api.forgotPassword(email);
              setInfo('Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.');
            } else if (view === 'reset') {
              if (password !== confirm) throw new ApiError('As senhas não coincidem.', 400);
              const tokens = recoveryFromUrl();
              if (!tokens) throw new ApiError('Este link expirou. Solicite um novo e-mail.', 400);
              const { user } = await api.resetPassword(tokens.accessToken, tokens.refreshToken, password);
              window.history.replaceState({}, '', window.location.pathname);
              onEnter(user);
            } else {
              const { user } = await api.login(email, password);
              onEnter(user);
            }
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Não foi possível falar com o servidor. No PC, rode npm run dev.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="brand-line">
          <img className="brand-logo" src="/logo/OPTO%20-%20Azul.png" alt="Opto Gestão EPI" />
          <span>Opto Gestão EPI</span>
        </div>
        <h2>{title}</h2>
        {view === 'login' && (
          <>
            <label>
              E-mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label>
              Senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Entrando...' : 'Entrar'} <ArrowUpFromLine size={16} />
            </button>
            <button className="text-button login-link" type="button" onClick={() => { setView('forgot'); setError(''); setInfo(''); }}>
              Esqueci a senha
            </button>
          </>
        )}
        {view === 'forgot' && (
          <>
            <p className="login-help">Informe o e-mail da conta. Enviaremos um link para redefinir a senha.</p>
            <label>
              E-mail
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Enviando...' : 'Enviar link'}
            </button>
            <button className="text-button login-link" type="button" onClick={() => { setView('login'); setError(''); setInfo(''); }}>
              Voltar ao login
            </button>
          </>
        )}
        {view === 'reset' && (
          <>
            <p className="login-help">Defina uma nova senha com pelo menos 8 caracteres.</p>
            <label>
              Nova senha
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            <label>
              Confirmar senha
              <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={8} required />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </>
        )}
        {error && <small className="login-error">{error}</small>}
        {info && <small className="login-info">{info}</small>}
      </form>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<Page>('Dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [epis, setEpis] = useState<Epi[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [toast, setToast] = useState('');
  const [delivery, setDelivery] = useState<Epi | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [legal, setLegal] = useState<'privacidade' | 'termos' | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const canWrite = user?.role !== 'Visualizador';

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  }, []);

  const refresh = useCallback(async () => {
    const [nextEmployees, nextEpis, nextMovements] = await Promise.all([api.employees.list(), api.epis.list(), api.movements.list()]);
    setEmployees(nextEmployees);
    setEpis(nextEpis);
    setMovements(nextMovements);
  }, []);

  useEffect(() => {
    api
      .me()
      .then(async ({ user: nextUser }) => {
        setUser(nextUser);
        if (nextUser) await refresh();
      })
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('opto:unauthorized', onUnauthorized);
    return () => window.removeEventListener('opto:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filteredEpis = useMemo(
    () => epis.filter((item) => `${item.name} ${item.ca} ${item.category} ${item.brand}`.toLowerCase().includes(query.toLowerCase())),
    [epis, query],
  );
  const filteredMovements = useMemo(
    () => movements.filter((item) => `${item.type} ${item.epi} ${item.person} ${item.note}`.toLowerCase().includes(query.toLowerCase())),
    [movements, query],
  );
  const alerts = useMemo(
    () => epis.filter((item) => item.available <= item.minimum || item.broken > 0),
    [epis],
  );

  if (booting) return <div className="boot-screen">Carregando Opto Gestão EPI...</div>;
  if (!user) return <Login onEnter={async (nextUser) => { setUser(nextUser); try { await refresh(); } catch { /* sessão ok; dados recarregam nas telas */ } }} />;

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  };

  const openPage = (next: Page) => {
    setPage(next);
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark"><ShieldCheck size={21} /></div>
            {!collapsed && <div><strong>EPI Control</strong><small>gestão operacional</small></div>}
          </div>
          <button className="icon-button sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav>
          {nav.filter((item) => !item.adminOnly || user.role === 'Administração').map(({ label, icon: Icon }) => (
            <button key={label} className={page === label ? 'nav-item active' : 'nav-item'} onClick={() => openPage(label)} title={collapsed ? label : undefined}>
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="avatar">{user.initials}</div>
            {!collapsed && <div><strong>{user.name}</strong><small>{roleLabel(user.role)}</small></div>}
          </div>
          <button className="nav-item" onClick={logout}><ArrowUpFromLine size={18} />{!collapsed && <span>Sair</span>}</button>
        </div>
      </aside>

      <div className="main-area">
        <header>
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div>
            <p className="eyebrow">{todayLabel()}</p>
            <h1>{page}</h1>
          </div>
          <div className="header-actions">
            <label className="search">
              <Search size={17} />
              <input ref={searchRef} placeholder="Buscar no sistema..." value={query} onChange={(event) => setQuery(event.target.value)} />
              <kbd>Ctrl K</kbd>
            </label>
            <div className="notes-wrap">
              <button className="icon-button notification" type="button" aria-label="Notificações" onClick={() => setNotesOpen((open) => !open)}>
                <Bell size={19} />
                {alerts.length > 0 && <i />}
              </button>
              {notesOpen && (
                <div className="notes-panel">
                  <strong>Alertas</strong>
                  {alerts.length === 0 ? <p className="muted">Nenhum alerta no momento.</p> : alerts.map((item) => (
                    <button key={item.id} type="button" className="notes-item" onClick={() => { setNotesOpen(false); openPage('Estoque'); }}>
                      <span>{item.name}</span>
                      <small>{item.available <= item.minimum ? `Estoque baixo · ${item.available}` : `${item.broken} quebrado(s)`}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="avatar">{user.initials}</div>
          </div>
        </header>

        <main className="content">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} key={page}>
            {page === 'Dashboard' && <Dashboard user={user} canWrite={canWrite} revision={`${movements[0]?.id ?? '0'}-${epis.reduce((sum, item) => sum + item.available + item.inUse, 0)}`} onDelivery={() => { if (!epis[0]) return showToast('Cadastre um EPI para registrar entregas.'); if (!employees.some((item) => item.status === 'Ativo')) return showToast('Cadastre um colaborador ativo para entregar.'); setDelivery(epis[0]); }} onToast={showToast} />}
            {page === 'Funcionários' && <Employees query={query} employees={employees} canWrite={canWrite} onChange={refresh} onToast={showToast} />}
            {page === 'EPIs' && <EpisTable epis={filteredEpis} canWrite={canWrite} onDelivery={setDelivery} onChange={refresh} onToast={showToast} />}
            {page === 'Estoque' && <Stock epis={filteredEpis} canWrite={canWrite} onChange={refresh} onToast={showToast} />}
            {page === 'Movimentações' && <Movements movements={filteredMovements} canWrite={canWrite} epis={epis} employees={employees} onChange={refresh} onToast={showToast} />}
            {page === 'Inventário' && <Inventory canWrite={canWrite} onToast={showToast} onChange={refresh} />}
            {page === 'Contratos' && <Contracts />}
            {page === 'Relatórios' && <Reports epis={epis} employees={employees} movements={movements} />}
            {page === 'Usuários' && <UsersPage user={user} onToast={showToast} />}
            {page === 'Configurações' && <SettingsPage user={user} onToast={showToast} />}
          </motion.div>
        </main>

        <Footer
          logo={<div className="footer-logo"><ShieldCheck size={20} /></div>}
          brandName="EPI Control"
          socialLinks={[
            { icon: <ExternalLink size={17} />, href: 'https://github.com', label: 'GitHub' },
            { icon: <ExternalLink size={17} />, href: 'https://instagram.com', label: 'Instagram' },
            { icon: <ExternalLink size={17} />, href: 'https://linkedin.com', label: 'LinkedIn' },
          ]}
          mainLinks={[{ href: '#dashboard', label: 'Dashboard' }, { href: '#epis', label: 'EPIs' }, { href: '#estoque', label: 'Estoque' }, { href: '#relatorios', label: 'Relatórios' }]}
          legalLinks={[{ href: '#privacidade', label: 'Privacidade' }, { href: '#termos', label: 'Termos de uso' }]}
          copyright={{ text: `© ${new Date().getFullYear()} OPTO - Miguel Vaz`, license: 'Todos os direitos reservados.' }}
          onMainLink={(href) => {
            const pages: Record<string, Page> = { '#dashboard': 'Dashboard', '#epis': 'EPIs', '#estoque': 'Estoque', '#relatorios': 'Relatórios' };
            openPage(pages[href] ?? 'Dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onLegalLink={(href) => setLegal(href === '#termos' ? 'termos' : 'privacidade')}
        />
      </div>

      {legal && (
        <Modal title={legal === 'termos' ? 'Termos de uso' : 'Privacidade'} onClose={() => setLegal(null)}>
          <p className="login-help">
            {legal === 'termos'
              ? 'O Opto Gestão EPI é um sistema interno para controle de equipamentos de proteção. Use apenas com credenciais autorizadas e registre movimentações reais da operação.'
              : 'Dados de colaboradores, EPIs e acessos ficam no seu projeto Supabase. Senhas não são armazenadas neste aplicativo; a autenticação é feita pelo Supabase Auth.'}
          </p>
          <div className="form-actions"><button className="primary-button" type="button" onClick={() => setLegal(null)}>Entendi</button></div>
        </Modal>
      )}
      {toast && <motion.div className="toast" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}><ClipboardCheck size={18} />{toast}</motion.div>}
      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={22} /></button>}
      {delivery && (
        <MovementForm
          title="Registrar entrega"
          epis={epis}
          employees={employees}
          initial={{ type: 'Entrega', epiId: delivery.id }}
          onClose={() => setDelivery(null)}
          onSaved={async () => { await refresh(); showToast(`Entrega registrada: ${delivery.name}`); setDelivery(null); }}
        />
      )}
    </div>
  );
}

function Dashboard({ user, canWrite, revision, onDelivery, onToast }: { user: AuthUser; canWrite: boolean; revision: string; onDelivery: () => void; onToast: (message: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch((error) => onToast(error instanceof ApiError ? error.message : 'Erro ao carregar o painel.'));
  }, [revision, onToast]);

  if (!data) return <p className="muted">Carregando visão geral...</p>;
  const maxBar = Math.max(1, ...data.chart.map((item) => item.value));

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="kicker">VISÃO GERAL</p>
          <h2>{greeting()}, {firstName(user.name)}.</h2>
          <p>Acompanhe a operação de EPIs da unidade em um só lugar.</p>
        </div>
        {canWrite && <button className="primary-button" onClick={onDelivery}><ArrowDownToLine size={16} /> Nova entrega</button>}
      </section>
      <div className="stats-grid">
        <StatCard label="Total de EPIs" value={data.total} detail="unidades cadastradas" icon={Boxes} />
        <StatCard label="Disponíveis" value={data.available} detail="prontos para entrega" icon={Package} tone="success" />
        <StatCard label="Em uso" value={data.inUse} detail="com funcionários" icon={Users} tone="info" />
        <StatCard label="Pendentes" value={data.pending} detail="em posse dos colaboradores" icon={ClipboardCheck} tone="warning" />
        <StatCard label="Perdidos" value={data.lost} detail="registrados" icon={AlertTriangle} tone="danger" />
        <StatCard label="Quebrados" value={data.broken} detail="substituição necessária" icon={AlertTriangle} tone="danger" />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">MOVIMENTAÇÃO</p><h3>Entregas nos últimos 6 meses</h3></div>
            <span className="muted">Quantidade real</span>
          </div>
          <div className="chart">
            <div className="chart-y"><span>{maxBar}</span><span>{Math.round(maxBar * 0.66)}</span><span>{Math.round(maxBar * 0.33)}</span><span>0</span></div>
            <div className="chart-body">
              <div className="chart-lines"><i /><i /><i /><i /></div>
              <div className="bars">
                {data.chart.map((item) => (
                  <div className="bar-wrap" key={item.month}>
                    <div className="bar" style={{ height: `${Math.max(6, (item.value / maxBar) * 100)}%` }} />
                    <span>{item.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="panel alert-panel">
          <div className="panel-heading"><div><p className="eyebrow">ATENÇÃO</p><h3>Estoque baixo</h3></div><AlertTriangle size={18} className="yellow" /></div>
          {data.lowStock.length ? data.lowStock.map((item) => (
            <div className="alert-row" key={item.id}>
              <div className="mini-icon"><Package size={16} /></div>
              <div><strong>{item.name}</strong><span>{item.available} disponíveis / mínimo {item.minimum}</span></div>
              <Badge tone="warning">Repor</Badge>
            </div>
          )) : <p className="muted">Nenhum item abaixo do mínimo.</p>}
        </section>
      </div>
      <section className="panel broken-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">MANUTENÇÃO</p><h3>Itens quebrados</h3></div>
          <Badge tone={data.broken ? 'danger' : 'success'}>{data.broken ? `${data.broken} para substituir` : 'Tudo em ordem'}</Badge>
        </div>
        {data.brokenEpis.length ? (
          <div className="broken-list">
            {data.brokenEpis.map((item) => (
              <div className="broken-row" key={item.id}>
                <div className="mini-icon danger"><AlertTriangle size={16} /></div>
                <div className="broken-info"><strong>{item.name}</strong><span>{item.category} · {item.broken} {item.broken === 1 ? 'unidade quebrada' : 'unidades quebradas'}</span></div>
                <div className="broken-meter"><i style={{ width: `${Math.min(100, (item.broken / data.broken) * 100)}%` }} /></div>
                <Badge tone={item.broken >= 2 ? 'danger' : 'warning'}>{item.broken >= 2 ? 'Prioridade alta' : 'Verificar'}</Badge>
              </div>
            ))}
          </div>
        ) : <p className="muted">Nenhum item quebrado registrado.</p>}
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading"><div><p className="eyebrow">RASTREABILIDADE</p><h3>Atividade recente</h3></div></div>
        <div className="activity-list">
          {data.recent.slice(0, 4).map((movement) => (
            <div className="activity-row" key={movement.id}>
              <div className={`movement-icon ${movement.type.toLowerCase()}`}><Activity size={16} /></div>
              <div><strong>{movement.type} de {movement.epi}</strong><span>{movement.person} · {movement.note || 'Sem observação'}</span></div>
              <time>{formatDateTime(movement.date)}</time>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Employees({ query, employees, canWrite, onChange, onToast }: { query: string; employees: Employee[]; canWrite: boolean; onChange: () => Promise<void>; onToast: (message: string) => void }) {
  const [editing, setEditing] = useState<Partial<Employee> | null>(null);
  const filtered = employees.filter((employee) => `${employee.name} ${employee.registration} ${employee.sector} ${employee.role}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="panel table-panel">
      <div className="page-intro compact">
        <div><p className="kicker">CADASTRO</p><h2>Funcionários</h2><p>{filtered.length} colaboradores encontrados</p></div>
        {canWrite && <button className="primary-button" onClick={() => setEditing({ name: '', registration: '', role: '', sector: '', admission: isoToday(), status: 'Ativo' })}><Users size={16} /> Novo funcionário</button>}
      </div>
      <Table
        headers={['Colaborador', 'Matrícula', 'Cargo / setor', 'Admissão', 'Status', '']}
        rows={filtered.map((employee) => [
          <div className="person" key={employee.id}><div className="avatar soft">{employee.initials}</div><strong>{employee.name}</strong></div>,
          employee.registration,
          <span key={`${employee.id}-role`}>{employee.role}<small>{employee.sector}</small></span>,
          formatDate(employee.admission),
          <Badge key={`${employee.id}-status`} tone={employee.status === 'Ativo' ? 'success' : 'warning'}>{employee.status}</Badge>,
          canWrite ? <button key={`${employee.id}-edit`} className="small-action" onClick={() => setEditing(employee)}>Editar</button> : '',
        ])}
      />
      {editing && (
        <EmployeeForm
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await onChange(); onToast(editing.id ? 'Colaborador atualizado' : 'Colaborador cadastrado'); setEditing(null); }}
        />
      )}
    </section>
  );
}

function EmployeeForm({ value, onClose, onSaved }: { value: Partial<Employee>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: value.name ?? '',
    registration: value.registration ?? '',
    role: value.role ?? '',
    sector: value.sector ?? '',
    admission: value.admission ?? isoToday(),
    status: (value.status ?? 'Ativo') as EmployeeStatus,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (value.id) await api.employees.update(value.id, form);
      else await api.employees.create(form);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={value.id ? 'Editar colaborador' : 'Novo colaborador'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <label>Matrícula<input value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value })} required /></label>
        <div className="form-two">
          <label>Cargo<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} required /></label>
          <label>Setor<input value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} required /></label>
        </div>
        <div className="form-two">
          <label>Admissão<input type="date" value={form.admission} onChange={(event) => setForm({ ...form, admission: event.target.value })} required /></label>
          <label>Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EmployeeStatus })}>
              <option>Ativo</option>
              <option>Afastado</option>
              <option>Desligado</option>
            </select>
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EpisTable({ epis, canWrite, onDelivery, onChange, onToast }: { epis: Epi[]; canWrite: boolean; onDelivery: (epi: Epi) => void; onChange: () => Promise<void>; onToast: (message: string) => void }) {
  const [editing, setEditing] = useState<Partial<Epi> | null>(null);

  return (
    <section className="panel table-panel">
      <div className="page-intro compact">
        <div><p className="kicker">CATÁLOGO</p><h2>EPIs e equipamentos</h2><p>Controle de certificados, validade e uso.</p></div>
        {canWrite && <button className="primary-button" onClick={() => setEditing({ name: '', category: '', brand: '', ca: '', expiry: isoNextYear(), minimum: 10, available: 0 })}><HardHat size={16} /> Cadastrar EPI</button>}
      </div>
      <Table
        headers={['Equipamento', 'Categoria', 'CA', 'Validade', 'Disponível', 'Status', '']}
        rows={epis.map((epi) => [
          <div className="person" key={epi.id}><div className="epi-symbol"><HardHat size={17} /></div><strong>{epi.name}</strong></div>,
          epi.category,
          `CA ${epi.ca}`,
          formatDate(epi.expiry),
          epi.available,
          <Badge key={`${epi.id}-status`} tone={epi.available <= epi.minimum ? 'warning' : 'success'}>{epi.available <= epi.minimum ? 'Baixo estoque' : 'Normal'}</Badge>,
          canWrite ? (
            <span className="row-actions" key={`${epi.id}-actions`}>
              <button className="small-action" onClick={() => onDelivery(epi)}>Entregar</button>
              <button className="small-action" onClick={() => setEditing(epi)}>Editar</button>
            </span>
          ) : '',
        ])}
      />
      {editing && (
        <EpiForm
          value={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { await onChange(); onToast(editing.id ? 'EPI atualizado' : 'EPI cadastrado'); setEditing(null); }}
        />
      )}
    </section>
  );
}

function EpiForm({ value, onClose, onSaved }: { value: Partial<Epi>; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    name: value.name ?? '',
    category: value.category ?? '',
    brand: value.brand ?? '',
    ca: value.ca ?? '',
    expiry: value.expiry ?? isoNextYear(),
    minimum: value.minimum ?? 10,
    available: value.available ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, minimum: Number(form.minimum), available: Number(form.available) };
      if (value.id) await api.epis.update(value.id, payload);
      else await api.epis.create(payload);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={value.id ? 'Editar EPI' : 'Cadastrar EPI'} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Nome<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        <div className="form-two">
          <label>Categoria<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
          <label>Marca<input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} required /></label>
        </div>
        <div className="form-two">
          <label>CA<input value={form.ca} onChange={(event) => setForm({ ...form, ca: event.target.value })} required /></label>
          <label>Validade<input type="date" value={form.expiry} onChange={(event) => setForm({ ...form, expiry: event.target.value })} required /></label>
        </div>
        <div className="form-two">
          <label>Estoque mínimo<input type="number" min={0} value={form.minimum} onChange={(event) => setForm({ ...form, minimum: Number(event.target.value) })} required /></label>
          <label>Disponível<input type="number" min={0} value={form.available} onChange={(event) => setForm({ ...form, available: Number(event.target.value) })} required /></label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Stock({ epis, canWrite, onChange, onToast }: { epis: Epi[]; canWrite: boolean; onChange: () => Promise<void>; onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel table-panel">
      <div className="page-intro compact">
        <div><p className="kicker">ALMOXARIFADO</p><h2>Controle de estoque</h2><p>Posição atual por equipamento.</p></div>
        {canWrite && <button className="outline-button" onClick={() => setOpen(true)}><ArrowDownToLine size={16} /> Registrar entrada</button>}
      </div>
      <div className="stock-summary">
        <div><span>Total</span><strong>{epis.reduce((sum, item) => sum + item.available + item.inUse, 0)}</strong></div>
        <div><span>Disponível</span><strong className="green">{epis.reduce((sum, item) => sum + item.available, 0)}</strong></div>
        <div><span>Em uso</span><strong>{epis.reduce((sum, item) => sum + item.inUse, 0)}</strong></div>
        <div><span>Alertas</span><strong className="yellow">{epis.filter((item) => item.available <= item.minimum).length}</strong></div>
      </div>
      <Table
        headers={['EPI', 'Categoria', 'Atual', 'Mínimo', 'Em uso', 'Disponível', 'Status']}
        rows={epis.map((epi) => [
          epi.name,
          epi.category,
          epi.available + epi.inUse,
          epi.minimum,
          epi.inUse,
          epi.available,
          <Badge key={epi.id} tone={epi.available <= epi.minimum ? 'warning' : 'success'}>{epi.available <= epi.minimum ? 'Estoque baixo' : 'Normal'}</Badge>,
        ])}
      />
      {open && (
        <MovementForm
          title="Entrada de estoque"
          epis={epis}
          employees={[]}
          initial={{ type: 'Entrada' }}
          onClose={() => setOpen(false)}
          onSaved={async () => { await onChange(); onToast('Entrada registrada'); setOpen(false); }}
        />
      )}
    </section>
  );
}

function Movements({ movements, canWrite, epis, employees, onChange, onToast }: { movements: Movement[]; canWrite: boolean; epis: Epi[]; employees: Employee[]; onChange: () => Promise<void>; onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel table-panel">
      <div className="page-intro compact">
        <div><p className="kicker">AUDITORIA</p><h2>Movimentações</h2><p>Histórico completo de entradas e saídas.</p></div>
        <div className="header-actions">
          {canWrite && <button className="primary-button" onClick={() => setOpen(true)}>Nova movimentação</button>}
          <button className="outline-button" onClick={() => downloadCsv('movimentacoes.csv', ['Tipo', 'Equipamento', 'Quantidade', 'Responsável', 'Data', 'Observação'], movements.map((item) => [item.type, item.epi, item.quantity, item.person, formatDateTime(item.date), item.note]))}><FileText size={16} /> Exportar</button>
        </div>
      </div>
      <Table
        headers={['Tipo', 'Equipamento', 'Quantidade', 'Responsável', 'Data', 'Observação']}
        rows={movements.map((item) => [
          <Badge key={item.id} tone={item.type === 'Perda' || item.type === 'Quebra' ? 'danger' : item.type === 'Entrega' ? 'info' : 'neutral'}>{item.type}</Badge>,
          item.epi,
          item.quantity,
          item.person,
          formatDateTime(item.date),
          item.note,
        ])}
      />
      {open && (
        <MovementForm
          title="Nova movimentação"
          epis={epis}
          employees={employees}
          initial={{ type: 'Entrega' }}
          onClose={() => setOpen(false)}
          onSaved={async () => { await onChange(); onToast('Movimentação registrada'); setOpen(false); }}
        />
      )}
    </section>
  );
}

function MovementForm({ title, epis, employees, initial, onClose, onSaved }: { title: string; epis: Epi[]; employees: Employee[]; initial: { type: MovementType; epiId?: string }; onClose: () => void; onSaved: () => Promise<void> }) {
  const [type, setType] = useState<MovementType>(initial.type);
  const [epiId, setEpiId] = useState(initial.epiId ?? epis[0]?.id ?? '');
  const [employeeId, setEmployeeId] = useState(employees.find((item) => item.status === 'Ativo')?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsEmployee = type === 'Entrega' || type === 'Devolução';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.movements.create({ type, epiId, employeeId: needsEmployee ? employeeId : null, quantity, note });
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label>Tipo
          <select value={type} onChange={(event) => setType(event.target.value as MovementType)}>
            <option>Entrada</option>
            <option>Entrega</option>
            <option>Devolução</option>
            <option>Perda</option>
            <option>Quebra</option>
            <option>Ajuste</option>
          </select>
        </label>
        <label>EPI
          <select value={epiId} onChange={(event) => setEpiId(event.target.value)} required>
            {epis.map((epi) => <option key={epi.id} value={epi.id}>{epi.name} · {epi.available} disp.</option>)}
          </select>
        </label>
        {needsEmployee && (
          <label>Colaborador
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
              {employees.filter((item) => item.status === 'Ativo' || item.id === employeeId).map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>
              ))}
            </select>
          </label>
        )}
        <label>Quantidade<input type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>
        <label>Observação<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Opcional" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="outline-button" onClick={onClose}>Cancelar</button>
          <button className="primary-button" disabled={busy || !epiId || (needsEmployee && !employeeId)}>{busy ? 'Registrando...' : 'Confirmar'}</button>
        </div>
      </form>
    </Modal>
  );
}

function Inventory({ canWrite, onToast, onChange }: { canWrite: boolean; onToast: (message: string) => void; onChange: () => Promise<void> }) {
  const [session, setSession] = useState<InventorySession | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setSession(await api.inventory.current());
    } catch (error) {
      onToast(error instanceof ApiError ? error.message : 'Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const start = async () => {
    try {
      setSession(await api.inventory.start());
      onToast('Inventário iniciado');
    } catch (error) {
      onToast(error instanceof ApiError ? error.message : 'Não foi possível iniciar');
    }
  };

  const close = async () => {
    if (!session) return;
    try {
      const next = await api.inventory.close(session.id);
      setSession(next);
      await onChange();
      onToast('Inventário encerrado e ajustes lançados');
    } catch (error) {
      onToast(error instanceof ApiError ? error.message : 'Não foi possível encerrar');
    }
  };

  const divergences = session?.items.filter((item) => item.difference !== 0).length ?? 0;

  return (
    <section className="panel table-panel">
      <div className="page-intro compact">
        <div>
          <p className="kicker">CONFERÊNCIA FÍSICA</p>
          <h2>Inventário</h2>
          <p>{session ? `${session.status} · iniciado por ${session.startedBy} em ${formatDateTime(session.createdAt)} · ${divergences} divergências` : 'Nenhuma sessão registrada ainda.'}</p>
        </div>
        {canWrite && session?.status !== 'Aberto' && <button className="primary-button" onClick={start}><ClipboardCheck size={16} /> Iniciar inventário</button>}
        {canWrite && session?.status === 'Aberto' && <button className="primary-button" onClick={close}>Encerrar e ajustar estoque</button>}
      </div>
      {loading ? <p className="muted">Carregando...</p> : (
        <Table
          headers={['EPI', 'Sistema', 'Encontrado', 'Diferença', 'Status']}
          rows={(session?.items ?? []).map((item) => [
            item.epi,
            item.expected,
            session?.status === 'Aberto' && canWrite ? (
              <input
                className="inline-input"
                key={item.id}
                type="number"
                min={0}
                defaultValue={item.found ?? item.expected}
                onBlur={async (event) => {
                  const found = Number(event.target.value);
                  const updated = await api.inventory.count(item.id, found) as InventorySession['items'][number];
                  setSession((current) => current ? { ...current, items: current.items.map((entry) => entry.id === item.id ? updated : entry) } : current);
                }}
              />
            ) : item.found ?? item.expected,
            item.difference,
            <Badge key={`${item.id}-status`} tone={item.difference !== 0 ? 'warning' : 'success'}>{item.difference !== 0 ? 'Divergência' : 'Conferido'}</Badge>,
          ])}
        />
      )}
    </section>
  );
}

function Reports({ epis, employees, movements }: { epis: Epi[]; employees: Employee[]; movements: Movement[] }) {
  const reports = [
    { title: 'Relatório de entregas', run: () => downloadCsv('entregas.csv', ['Data', 'EPI', 'Qtd', 'Colaborador', 'Obs'], movements.filter((item) => item.type === 'Entrega').map((item) => [formatDateTime(item.date), item.epi, item.quantity, item.person, item.note])) },
    { title: 'Relatório de devoluções', run: () => downloadCsv('devolucoes.csv', ['Data', 'EPI', 'Qtd', 'Colaborador', 'Obs'], movements.filter((item) => item.type === 'Devolução').map((item) => [formatDateTime(item.date), item.epi, item.quantity, item.person, item.note])) },
    { title: 'Relatório de perdas', run: () => downloadCsv('perdas.csv', ['Data', 'EPI', 'Qtd', 'Responsável', 'Obs'], movements.filter((item) => item.type === 'Perda' || item.type === 'Quebra').map((item) => [formatDateTime(item.date), item.epi, item.quantity, item.person, item.note])) },
    { title: 'Relatório de estoque', run: () => downloadCsv('estoque.csv', ['EPI', 'Categoria', 'CA', 'Disponível', 'Em uso', 'Perdidos', 'Quebrados', 'Mínimo'], epis.map((item) => [item.name, item.category, item.ca, item.available, item.inUse, item.lost, item.broken, item.minimum])) },
    { title: 'Por funcionário', run: () => downloadCsv('colaboradores.csv', ['Nome', 'Matrícula', 'Cargo', 'Setor', 'Status', 'Admissão'], employees.map((item) => [item.name, item.registration, item.role, item.sector, item.status, formatDate(item.admission)])) },
    { title: 'Relatório de inventário', run: () => downloadCsv('movimentacoes.csv', ['Tipo', 'EPI', 'Qtd', 'Pessoa', 'Data', 'Obs'], movements.map((item) => [item.type, item.epi, item.quantity, item.person, formatDateTime(item.date), item.note])) },
  ];

  return (
    <section className="reports">
      <div className="page-intro">
        <div><p className="kicker">INTELIGÊNCIA OPERACIONAL</p><h2>Relatórios</h2><p>Gere visões auditáveis para apoiar suas decisões.</p></div>
      </div>
      <div className="report-grid">
        {reports.map((report, index) => (
          <div className="report-card" key={report.title}>
            <div className="report-icon"><FileText size={19} /></div>
            <h3>{report.title}</h3>
            <p>Dados consolidados e prontos para análise.</p>
            <button className="text-button" onClick={report.run}>Gerar relatório <ArrowUpFromLine size={14} /></button>
            <span className="report-number">0{index + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const completed = contracts.filter((item) => item.status === 'Concluído').length;

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files)
      .filter((file) => file.name.toLowerCase().endsWith('.pdf'))
      .map((file, index) => ({ id: `${Date.now()}-${index}`, name: file.name, status: 'Extraindo' as ContractStatus, confidence: 0, ...contractFields(file.name) }));
    setContracts((current) => [...incoming, ...current]);
    incoming.forEach((item, index) => {
      window.setTimeout(() => {
        setContracts((current) => current.map((contract) => contract.id === item.id ? { ...contract, status: 'Concluído', confidence: 94 - index * 3 } : contract));
      }, 500 + index * 180);
    });
  };

  return (
    <section className="contracts-page in-app">
      <div className="page-intro">
        <div>
          <p className="kicker">MODO DE EXECUÇÃO</p>
          <h2>Extração de contratos</h2>
          <p>Processe vários PDFs e revise os campos extraídos.</p>
        </div>
      </div>
      <label className="contract-dropzone">
        <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => onFiles(event.target.files)} />
        <UploadCloud size={30} />
        <strong>Selecionar contratos PDF</strong>
        <span>O processamento começa automaticamente</span>
      </label>
      <div className="contract-toolbar"><span><Zap size={15} /> {completed} de {contracts.length} concluídos</span></div>
      {contracts.length === 0 ? (
        <section className="panel contract-empty"><Sparkles size={24} /><h3>Fila pronta para começar</h3><p>Adicione PDFs para extrair fornecedor, valor e vencimento.</p></section>
      ) : contracts.map((item) => (
        <article className="panel contract-row" key={item.id}>
          <div className="contract-file"><FileText size={20} /><strong>{item.name}</strong></div>
          {item.status === 'Extraindo' ? <span>Extraindo...</span> : (
            <div className="contract-fields">
              <span><small>Fornecedor</small>{item.supplier}</span>
              <span><small>Valor</small>{item.value}</span>
              <span><small>Vencimento</small>{item.expires}</span>
              <b><CheckCircle2 size={15} /> {item.confidence}%</b>
            </div>
          )}
          <button className="icon-button" onClick={() => setContracts((current) => current.filter((contract) => contract.id !== item.id))} aria-label="Remover contrato"><Trash2 size={16} /></button>
        </article>
      ))}
    </section>
  );
}

function UsersPage({ user, onToast }: { user: AuthUser; onToast: (message: string) => void }) {
  const isAdmin = user.role === 'Administração';
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [creating, setCreating] = useState(emptyUserForm);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'Técnico' as Role, active: true });
  const [busy, setBusy] = useState(false);

  const loadUsers = async () => {
    setUsers(await api.users.list());
  };

  useEffect(() => {
    if (!isAdmin) return;
    void loadUsers().catch((error) => onToast(error instanceof Error ? error.message : 'Não foi possível carregar os usuários.'));
  }, [isAdmin, onToast]);

  if (!isAdmin) {
    return <p className="muted">Somente a Administração gerencia usuários do sistema.</p>;
  }

  const openEdit = (item: SystemUser) => {
    setEditing(item);
    setEditForm({ name: item.name, email: item.email, password: '', role: item.role, active: item.active });
  };

  const toggleActive = async (item: SystemUser) => {
    try {
      await api.users.update(item.id, { active: !item.active });
      await loadUsers();
      onToast(item.active ? `${item.name} desativado` : `${item.name} reativado`);
    } catch (error) {
      onToast(error instanceof ApiError ? error.message : 'Não foi possível alterar o status.');
    }
  };

  return (
    <>
      <div className="page-intro">
        <div>
          <p className="kicker">ACESSO</p>
          <h2>Usuários do sistema</h2>
          <p>Sua conta já é Administração. Crie o técnico de segurança e os demais acessos por aqui.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">PERFIS</p>
              <h3>O que cada acesso pode fazer</h3>
            </div>
          </div>
          <div className="role-legend">
            <article><strong>Administração</strong><span>Cria, edita, ativa e desativa usuários. Opera todo o sistema.</span></article>
            <article><strong>Técnico de segurança</strong><span>Opera EPIs, estoque, entregas, movimentações e inventário.</span></article>
            <article><strong>Visualizador</strong><span>Consulta dashboards e listas, sem alterar dados.</span></article>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">NOVO ACESSO</p><h3>Criar usuário</h3></div></div>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await api.users.create(creating);
                setCreating(emptyUserForm);
                await loadUsers();
                onToast('Usuário criado. Ele já pode entrar com este e-mail e senha.');
              } catch (error) {
                onToast(error instanceof ApiError ? error.message : 'Não foi possível criar o usuário');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-two">
              <label>Nome<input value={creating.name} onChange={(event) => setCreating({ ...creating, name: event.target.value })} required /></label>
              <label>E-mail<input type="email" value={creating.email} onChange={(event) => setCreating({ ...creating, email: event.target.value })} required /></label>
            </div>
            <div className="form-two">
              <label>Senha inicial<input type="password" value={creating.password} onChange={(event) => setCreating({ ...creating, password: event.target.value })} minLength={8} required /></label>
              <label>Perfil<RoleSelect value={creating.role} onChange={(role) => setCreating({ ...creating, role })} /></label>
            </div>
            <div className="form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Criando...' : 'Criar usuário'}</button></div>
          </form>
        </section>
        <section className="panel table-panel">
          <div className="panel-heading compact"><div><p className="eyebrow">CADASTRO</p><h3>Quem tem acesso</h3></div></div>
          <Table
            headers={['Usuário', 'E-mail', 'Perfil', 'Status', '']}
            rows={users.map((item) => [
              <div className="person" key={item.id}>
                <div className="avatar soft">{item.initials}</div>
                <div>
                  <strong>{item.name}</strong>
                  {item.id === user.id ? <small>Você</small> : null}
                </div>
              </div>,
              item.email,
              roleLabel(item.role),
              <Badge key={`${item.id}-active`} tone={item.active ? 'success' : 'warning'}>{item.active ? 'Ativo' : 'Inativo'}</Badge>,
              <div className="row-actions" key={`${item.id}-actions`}>
                <button className="small-action" type="button" onClick={() => openEdit(item)}>Editar</button>
                {item.id !== user.id && (
                  <button className="small-action" type="button" onClick={() => void toggleActive(item)}>
                    {item.active ? 'Desativar' : 'Ativar'}
                  </button>
                )}
              </div>,
            ])}
          />
        </section>
      </div>
      {editing && (
        <Modal title={`Editar ${editing.name}`} onClose={() => setEditing(null)}>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await api.users.update(editing.id, {
                  name: editForm.name,
                  email: editForm.email,
                  role: editForm.role,
                  active: editForm.active,
                  ...(editForm.password ? { password: editForm.password } : {}),
                });
                setEditing(null);
                await loadUsers();
                onToast('Usuário atualizado');
              } catch (error) {
                onToast(error instanceof ApiError ? error.message : 'Não foi possível salvar.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-two">
              <label>Nome<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required /></label>
              <label>E-mail<input type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required /></label>
            </div>
            <div className="form-two">
              <label>Nova senha (opcional)<input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} minLength={editForm.password ? 8 : undefined} placeholder="Deixe em branco para manter" /></label>
              <label>Perfil<RoleSelect value={editForm.role} onChange={(role) => setEditForm({ ...editForm, role })} /></label>
            </div>
            {editing.id !== user.id && (
              <label>
                Status
                <select value={editForm.active ? 'ativo' : 'inativo'} onChange={(event) => setEditForm({ ...editForm, active: event.target.value === 'ativo' })}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
            )}
            <div className="form-actions">
              <button className="outline-button" type="button" onClick={() => setEditing(null)}>Cancelar</button>
              <button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function SettingsPage({ user, onToast }: { user: AuthUser; onToast: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">CONTA</p><h3>Alterar senha</h3></div></div>
        <form
          className="form-grid"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api.changePassword(currentPassword, newPassword);
              setCurrentPassword('');
              setNewPassword('');
              onToast('Senha atualizada');
            } catch (error) {
              onToast(error instanceof ApiError ? error.message : 'Não foi possível alterar a senha');
            }
          }}
        >
          <label>Senha atual<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label>Nova senha<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label>
          <div className="form-actions"><button className="primary-button">Salvar senha</button></div>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><p className="eyebrow">SEU ACESSO</p><h3>{user.name}</h3></div></div>
        <p className="muted">{user.email} · {roleLabel(user.role)}</p>
        {user.role === 'Administração' && <p className="muted">Para criar ou desativar contas, use o menu Usuários.</p>}
      </section>
    </div>
  );
}
