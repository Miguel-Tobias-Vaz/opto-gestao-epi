import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabase, supabaseAuth } from './supabase.ts';
import { mapEmployee, mapEpi, mapInventory, mapMovement, mapUser, publicUser, throwDb } from './db.ts';
import { canAssignRole, canManageProfile, canManageUsers, canWrite, clearAuthCookies, loadProfile, requireAuth, requireRole, setAuthCookies } from './auth.ts';
import {
  HttpError,
  asyncHandler,
  changePasswordSchema,
  createUserSchema,
  employeeSchema,
  epiPatchSchema,
  epiSchema,
  forgotPasswordSchema,
  inventoryCountSchema,
  loginSchema,
  movementSchema,
  resetPasswordSchema,
  updateUserSchema,
} from './http.ts';
import type { EmployeeRow, EpiRow, InventoryItemRow, InventorySessionRow, MovementRow, ProfileRow } from './types.ts';

export const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Muitas tentativas de acesso. Aguarde alguns minutos.' },
});

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

router.post(
  '/auth/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) {
      const raw = error?.message ?? '';
      if (/confirm/i.test(raw)) {
        throw new HttpError(401, 'E-mail ainda não confirmado. No Supabase: Authentication → Users → o usuário → Confirm.');
      }
      throw new HttpError(401, 'E-mail ou senha inválidos. Use o usuário criado em Authentication → Users.');
    }
    const profile = await loadProfile(
      data.user.id,
      data.user.email ?? email,
      (data.user.user_metadata?.name as string | undefined) || email.split('@')[0] || 'Administrador',
    );
    if (!profile.active) throw new HttpError(401, 'Usuário inativo.');
    setAuthCookies(res, data.session);
    res.json({ user: mapUser(profile), accessToken: data.session.access_token });
  }),
);

router.post('/auth/logout', (req, res) => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post(
  '/auth/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const check = await supabaseAuth.auth.signInWithPassword({ email: req.user!.email, password: currentPassword });
    if (check.error) throw new HttpError(400, 'Senha atual incorreta.');
    const updated = await supabase.auth.admin.updateUserById(req.user!.id, { password: newPassword });
    if (updated.error) throw new HttpError(400, updated.error.message);
    const next = await supabaseAuth.auth.signInWithPassword({ email: req.user!.email, password: newPassword });
    if (!next.data.session) throw new HttpError(400, 'Senha alterada. Entre novamente com a nova senha.');
    setAuthCookies(res, next.data.session);
    res.json({ ok: true, accessToken: next.data.session.access_token });
  }),
);

router.post(
  '/auth/forgot',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const redirectTo = (process.env.APP_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '');
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      console.error('resetPasswordForEmail', error.message);
      if (/redirect/i.test(error.message)) {
        throw new HttpError(400, 'Autorize http://localhost:5173 em Authentication → URL Configuration no Supabase.');
      }
      throw new HttpError(400, 'Não foi possível enviar o e-mail de redefinição. Confira o SMTP/e-mail no Supabase.');
    }
    res.json({ ok: true });
  }),
);

router.post(
  '/auth/reset',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, password } = resetPasswordSchema.parse(req.body);
    const auth = await supabaseAuth.auth.getUser(accessToken);
    if (auth.error || !auth.data.user?.email) {
      throw new HttpError(400, 'Este link expirou. Solicite um novo e-mail de redefinição.');
    }
    const updated = await supabase.auth.admin.updateUserById(auth.data.user.id, { password });
    if (updated.error) throw new HttpError(400, updated.error.message);
    const signed = await supabaseAuth.auth.signInWithPassword({ email: auth.data.user.email, password });
    if (signed.error || !signed.data.session) {
      throw new HttpError(400, 'Senha alterada. Entre novamente com a nova senha.');
    }
    const profile = await loadProfile(
      auth.data.user.id,
      auth.data.user.email,
      (auth.data.user.user_metadata?.name as string | undefined) || auth.data.user.email.split('@')[0] || 'Administrador',
    );
    if (!profile.active) throw new HttpError(401, 'Usuário inativo.');
    setAuthCookies(res, signed.data.session);
    res.json({ user: mapUser(profile), accessToken: signed.data.session.access_token });
  }),
);

router.get(
  '/users',
  requireAuth,
  requireRole(...canManageUsers),
  asyncHandler(async (req, res) => {
    let query = supabase.from('profiles').select('*').order('name');
    if (req.user!.role === 'Gerente') query = query.eq('role', 'Técnico');
    const { data, error } = await query;
    throwDb(error);
    res.json(((data ?? []) as ProfileRow[]).map(publicUser));
  }),
);

router.post(
  '/users',
  requireAuth,
  requireRole(...canManageUsers),
  asyncHandler(async (req, res) => {
    const body = createUserSchema.parse(req.body);
    if (!canAssignRole(req.user!.role, body.role)) {
      throw new HttpError(403, 'O gerente só cadastra técnico de segurança. Quem adiciona o gerente é o administrador.');
    }
    const created = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { name: body.name, role: body.role },
    });
    if (created.error || !created.data.user) {
      const message = created.error?.message.includes('already') ? 'Já existe um usuário com este e-mail.' : created.error?.message;
      throw new HttpError(409, message || 'Não foi possível criar o usuário.');
    }
    const profile = await supabase
      .from('profiles')
      .insert({
        id: created.data.user.id,
        name: body.name,
        email: body.email,
        role: body.role,
        active: true,
      })
      .select('*')
      .single();
    if (profile.error) {
      await supabase.auth.admin.deleteUser(created.data.user.id);
      throwDb(profile.error);
    }
    res.status(201).json(publicUser(profile.data as ProfileRow));
  }),
);

router.patch(
  '/users/:id',
  requireAuth,
  requireRole(...canManageUsers),
  asyncHandler(async (req, res) => {
    const body = updateUserSchema.parse(req.body);
    const current = await supabase.from('profiles').select('*').eq('id', req.params.id).maybeSingle();
    throwDb(current.error);
    if (!current.data) throw new HttpError(404, 'Usuário não encontrado.');
    const row = current.data as ProfileRow;

    if (!canManageProfile(req.user!.role, row.role)) {
      throw new HttpError(403, 'O gerente só gerencia técnicos de segurança.');
    }
    if (body.role && !canAssignRole(req.user!.role, body.role)) {
      throw new HttpError(403, 'O gerente não pode alterar o perfil para este acesso.');
    }

    if (body.active === false && row.id === req.user!.id) {
      throw new HttpError(400, 'Você não pode desativar o próprio acesso.');
    }
    if (body.active === false && row.role === 'Administração') {
      const admins = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Administração').eq('active', true).neq('id', row.id);
      throwDb(admins.error);
      if ((admins.count ?? 0) < 1) throw new HttpError(400, 'Mantenha pelo menos um administrador ativo.');
    }

    const authPatch: { email?: string; password?: string; user_metadata?: { name: string; role: string } } = {
      user_metadata: { name: body.name ?? row.name, role: body.role ?? row.role },
    };
    if (body.email) authPatch.email = body.email;
    if (body.password) authPatch.password = body.password;
    const authUpdate = await supabase.auth.admin.updateUserById(row.id, authPatch);
    if (authUpdate.error) throw new HttpError(400, authUpdate.error.message);

    const updated = await supabase
      .from('profiles')
      .update({
        name: body.name ?? row.name,
        email: body.email ?? row.email,
        role: body.role ?? row.role,
        active: body.active === undefined ? row.active : body.active,
      })
      .eq('id', row.id)
      .select('*')
      .single();
    throwDb(updated.error);
    res.json(publicUser(updated.data as ProfileRow));
  }),
);

router.get(
  '/employees',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from('employees').select('*').order('name');
    throwDb(error);
    res.json(((data ?? []) as EmployeeRow[]).map(mapEmployee));
  }),
);

router.post(
  '/employees',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const body = employeeSchema.parse(req.body);
    const created = await supabase.from('employees').insert(body).select('*').single();
    throwDb(created.error);
    res.status(201).json(mapEmployee(created.data as EmployeeRow));
  }),
);

router.patch(
  '/employees/:id',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const body = employeeSchema.partial().parse(req.body);
    const updated = await supabase.from('employees').update(body).eq('id', req.params.id).select('*').maybeSingle();
    throwDb(updated.error);
    if (!updated.data) throw new HttpError(404, 'Colaborador não encontrado.');
    res.json(mapEmployee(updated.data as EmployeeRow));
  }),
);

router.get(
  '/epis',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from('epis').select('*').order('name');
    throwDb(error);
    res.json(((data ?? []) as EpiRow[]).map(mapEpi));
  }),
);

router.post(
  '/epis',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const body = epiSchema.parse(req.body);
    const created = await supabase
      .from('epis')
      .insert({
        name: body.name,
        category: body.category,
        brand: body.brand,
        ca: body.ca,
        expiry: body.expiry,
        minimum: body.minimum,
        available: body.available ?? 0,
      })
      .select('*')
      .single();
    throwDb(created.error);
    res.status(201).json(mapEpi(created.data as EpiRow));
  }),
);

router.patch(
  '/epis/:id',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const body = epiPatchSchema.parse(req.body);
    const updated = await supabase.from('epis').update(body).eq('id', req.params.id).select('*').maybeSingle();
    throwDb(updated.error);
    if (!updated.data) throw new HttpError(404, 'EPI não encontrado.');
    res.json(mapEpi(updated.data as EpiRow));
  }),
);

router.get(
  '/movements',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from('movements').select('*').order('created_at', { ascending: false });
    throwDb(error);
    res.json(((data ?? []) as MovementRow[]).map(mapMovement));
  }),
);

router.post(
  '/movements',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const body = movementSchema.parse(req.body);
    if (body.type !== 'Ajuste' && body.quantity < 1) throw new HttpError(400, 'Quantidade deve ser no mínimo 1.');
    if (body.type === 'Ajuste' && body.quantity === 0) throw new HttpError(400, 'Informe um ajuste diferente de zero.');

    const epiRes = await supabase.from('epis').select('*').eq('id', body.epiId).maybeSingle();
    throwDb(epiRes.error);
    if (!epiRes.data) throw new HttpError(404, 'EPI não encontrado.');
    const epi = epiRes.data as EpiRow;

    let employee: EmployeeRow | undefined;
    if (body.employeeId) {
      const employeeRes = await supabase.from('employees').select('*').eq('id', body.employeeId).maybeSingle();
      throwDb(employeeRes.error);
      if (!employeeRes.data) throw new HttpError(404, 'Colaborador não encontrado.');
      employee = employeeRes.data as EmployeeRow;
    }

    let available = epi.available;
    let inUse = epi.in_use;
    let lost = epi.lost;
    let broken = epi.broken;

    if (body.type === 'Entrada') {
      available += body.quantity;
    } else if (body.type === 'Entrega') {
      if (!employee) throw new HttpError(400, 'Selecione o colaborador que recebe o EPI.');
      if (employee.status !== 'Ativo') throw new HttpError(400, 'Só é possível entregar EPI a colaborador ativo.');
      if (available < body.quantity) throw new HttpError(400, 'Estoque disponível insuficiente.');
      available -= body.quantity;
      inUse += body.quantity;
    } else if (body.type === 'Devolução') {
      if (inUse < body.quantity) throw new HttpError(400, 'Quantidade em uso insuficiente para devolução.');
      inUse -= body.quantity;
      available += body.quantity;
    } else if (body.type === 'Perda') {
      if (inUse >= body.quantity) inUse -= body.quantity;
      else if (available >= body.quantity) available -= body.quantity;
      else throw new HttpError(400, 'Não há unidades suficientes para registrar a perda.');
      lost += body.quantity;
    } else if (body.type === 'Quebra') {
      if (inUse >= body.quantity) inUse -= body.quantity;
      else if (available >= body.quantity) available -= body.quantity;
      else throw new HttpError(400, 'Não há unidades suficientes para registrar a quebra.');
      broken += body.quantity;
    } else if (body.type === 'Ajuste') {
      if (available + body.quantity < 0) throw new HttpError(400, 'O ajuste deixaria o estoque negativo.');
      available += body.quantity;
    }

    const stock = await supabase.from('epis').update({ available, in_use: inUse, lost, broken }).eq('id', epi.id);
    throwDb(stock.error);

    const movement = await supabase
      .from('movements')
      .insert({
        type: body.type,
        epi_id: epi.id,
        epi_name: epi.name,
        employee_id: employee?.id ?? null,
        person_name: employee?.name ?? req.user!.name,
        user_id: req.user!.id,
        quantity: body.quantity,
        note: body.note,
      })
      .select('*')
      .single();
    throwDb(movement.error);
    res.status(201).json(mapMovement(movement.data as MovementRow));
  }),
);

router.get(
  '/dashboard',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const episRes = await supabase.from('epis').select('*').order('name');
    throwDb(episRes.error);
    const mapped = ((episRes.data ?? []) as EpiRow[]).map(mapEpi);
    const total = mapped.reduce((sum, item) => sum + item.available + item.inUse + item.lost + item.broken, 0);
    const available = mapped.reduce((sum, item) => sum + item.available, 0);
    const inUse = mapped.reduce((sum, item) => sum + item.inUse, 0);
    const lost = mapped.reduce((sum, item) => sum + item.lost, 0);
    const broken = mapped.reduce((sum, item) => sum + item.broken, 0);
    const lowStock = mapped.filter((item) => item.available <= item.minimum);
    const brokenEpis = mapped.filter((item) => item.broken > 0).sort((a, b) => b.broken - a.broken);

    const recentRes = await supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(8);
    throwDb(recentRes.error);
    const recent = ((recentRes.data ?? []) as MovementRow[]).map(mapMovement);

    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - 5);
    const chartRes = await supabase.from('movements').select('created_at, quantity').eq('type', 'Entrega').gte('created_at', start.toISOString());
    throwDb(chartRes.error);
    const byMonth = new Map<string, number>();
    for (const row of chartRes.data ?? []) {
      const key = String(row.created_at).slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + Number(row.quantity));
    }
    const chart = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(start);
      date.setMonth(start.getMonth() + index);
      return {
        month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        value: byMonth.get(monthKey(date)) ?? 0,
      };
    });

    res.json({ total, available, inUse, lost, broken, pending: inUse, lowStock, brokenEpis, recent, chart });
  }),
);

router.get(
  '/inventory',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const open = await supabase.from('inventory_sessions').select('*').eq('status', 'Aberto').order('created_at', { ascending: false }).limit(1).maybeSingle();
    throwDb(open.error);
    const latest = open.data
      ? open
      : await supabase.from('inventory_sessions').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!open.data) throwDb(latest.error);
    const session = (open.data ?? latest.data) as InventorySessionRow | null;
    if (!session) {
      res.json(null);
      return;
    }
    const items = await supabase.from('inventory_items').select('*').eq('session_id', session.id).order('epi_name');
    throwDb(items.error);
    res.json(mapInventory(session, (items.data ?? []) as InventoryItemRow[]));
  }),
);

router.post(
  '/inventory',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const open = await supabase.from('inventory_sessions').select('id').eq('status', 'Aberto').limit(1).maybeSingle();
    throwDb(open.error);
    if (open.data) throw new HttpError(400, 'Já existe um inventário em andamento.');

    const episRes = await supabase.from('epis').select('*').order('name');
    throwDb(episRes.error);
    const epis = (episRes.data ?? []) as EpiRow[];
    if (!epis.length) throw new HttpError(400, 'Cadastre EPIs antes de iniciar o inventário.');

    const sessionRes = await supabase
      .from('inventory_sessions')
      .insert({ status: 'Aberto', started_by: req.user!.id, started_by_name: req.user!.name })
      .select('*')
      .single();
    throwDb(sessionRes.error);
    const session = sessionRes.data as InventorySessionRow;

    const itemsRes = await supabase.from('inventory_items').insert(
      epis.map((epi) => {
        const expected = epi.available + epi.in_use;
        return { session_id: session.id, epi_id: epi.id, epi_name: epi.name, expected, found: expected, difference: 0 };
      }),
    ).select('*');
    throwDb(itemsRes.error);
    res.status(201).json(mapInventory(session, (itemsRes.data ?? []) as InventoryItemRow[]));
  }),
);

router.patch(
  '/inventory/items/:id',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const { found } = inventoryCountSchema.parse(req.body);
    const itemRes = await supabase.from('inventory_items').select('*').eq('id', req.params.id).maybeSingle();
    throwDb(itemRes.error);
    if (!itemRes.data) throw new HttpError(404, 'Item de inventário não encontrado.');
    const item = itemRes.data as InventoryItemRow;
    const sessionRes = await supabase.from('inventory_sessions').select('*').eq('id', item.session_id).maybeSingle();
    throwDb(sessionRes.error);
    if (!sessionRes.data || (sessionRes.data as InventorySessionRow).status !== 'Aberto') {
      throw new HttpError(400, 'Este inventário já foi encerrado.');
    }
    const difference = found - item.expected;
    const updated = await supabase.from('inventory_items').update({ found, difference }).eq('id', item.id).select('*').single();
    throwDb(updated.error);
    const next = updated.data as InventoryItemRow;
    res.json({ id: next.id, epiId: next.epi_id, epi: next.epi_name, expected: next.expected, found: next.found, difference: next.difference });
  }),
);

router.post(
  '/inventory/:id/close',
  requireAuth,
  requireRole(...canWrite),
  asyncHandler(async (req, res) => {
    const sessionRes = await supabase.from('inventory_sessions').select('*').eq('id', req.params.id).maybeSingle();
    throwDb(sessionRes.error);
    if (!sessionRes.data) throw new HttpError(404, 'Inventário não encontrado.');
    const session = sessionRes.data as InventorySessionRow;
    if (session.status !== 'Aberto') throw new HttpError(400, 'Este inventário já foi encerrado.');

    const itemsRes = await supabase.from('inventory_items').select('*').eq('session_id', session.id);
    throwDb(itemsRes.error);
    const closedAt = new Date().toISOString();

    for (const item of (itemsRes.data ?? []) as InventoryItemRow[]) {
      const found = item.found ?? item.expected;
      const difference = found - item.expected;
      const itemUpdate = await supabase.from('inventory_items').update({ found, difference }).eq('id', item.id);
      throwDb(itemUpdate.error);
      if (difference === 0) continue;
      const epiRes = await supabase.from('epis').select('*').eq('id', item.epi_id).maybeSingle();
      throwDb(epiRes.error);
      const epi = epiRes.data as EpiRow | null;
      if (!epi) continue;
      if (epi.available + difference < 0) throw new HttpError(400, `O ajuste de ${epi.name} deixaria o estoque negativo.`);
      const stock = await supabase.from('epis').update({ available: epi.available + difference }).eq('id', epi.id);
      throwDb(stock.error);
      const movement = await supabase.from('movements').insert({
        type: 'Ajuste',
        epi_id: epi.id,
        epi_name: epi.name,
        employee_id: null,
        person_name: req.user!.name,
        user_id: req.user!.id,
        quantity: difference,
        note: `Ajuste de inventário (${difference > 0 ? '+' : ''}${difference})`,
        created_at: closedAt,
      });
      throwDb(movement.error);
    }

    const closed = await supabase.from('inventory_sessions').update({ status: 'Concluído', closed_at: closedAt }).eq('id', session.id).select('*').single();
    throwDb(closed.error);
    const items = await supabase.from('inventory_items').select('*').eq('session_id', session.id).order('epi_name');
    throwDb(items.error);
    res.json(mapInventory(closed.data as InventorySessionRow, (items.data ?? []) as InventoryItemRow[]));
  }),
);
