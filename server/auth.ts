import type { NextFunction, Request, Response } from 'express';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseAuth } from './supabase.ts';
import { mapUser, throwDb } from './db.ts';
import { HttpError } from './http.ts';
import type { AuthUser, ProfileRow, Role } from './types.ts';

export const ACCESS_COOKIE = 'opto_access';
export const REFRESH_COOKIE = 'opto_refresh';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookies(res: Response, session: Session) {
  const options = cookieOptions();
  res.cookie(REFRESH_COOKIE, session.refresh_token, options);
  res.setHeader('X-Access-Token', session.access_token);
}

export function clearAuthCookies(res: Response) {
  const options = { ...cookieOptions(), maxAge: 0 };
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}

export async function loadProfile(userId: string, email: string, fallbackName: string): Promise<ProfileRow> {
  const existing = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  throwDb(existing.error);
  if (existing.data) return existing.data as ProfileRow;

  const count = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  throwDb(count.error);
  if ((count.count ?? 0) > 0) {
    throw new HttpError(403, 'Esta conta ainda não tem acesso. Peça a um administrador para cadastrá-la.');
  }

  const created = await supabase
    .from('profiles')
    .insert({
      id: userId,
      name: fallbackName,
      email,
      role: 'Administração',
      active: true,
    })
    .select('*')
    .single();
  throwDb(created.error);
  return created.data as ProfileRow;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    let access = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[ACCESS_COOKIE];
    const refresh = req.cookies?.[REFRESH_COOKIE];

    if ((!access || typeof access !== 'string') && refresh) {
      const refreshed = await supabaseAuth.auth.refreshSession({ refresh_token: refresh });
      if (refreshed.data.session) {
        setAuthCookies(res, refreshed.data.session);
        access = refreshed.data.session.access_token;
      }
    }

    if (!access || typeof access !== 'string') {
      throw new HttpError(401, 'Sessão expirada. Entre novamente.');
    }

    let auth = await supabaseAuth.auth.getUser(access);
    if (auth.error && refresh) {
      const refreshed = await supabaseAuth.auth.refreshSession({ refresh_token: refresh });
      if (!refreshed.data.session) throw new HttpError(401, 'Sessão inválida. Entre novamente.');
      setAuthCookies(res, refreshed.data.session);
      auth = await supabaseAuth.auth.getUser(refreshed.data.session.access_token);
    }
    if (auth.error || !auth.data.user) {
      throw new HttpError(401, 'Sessão inválida. Entre novamente.');
    }

    const profile = await loadProfile(
      auth.data.user.id,
      auth.data.user.email ?? '',
      (auth.data.user.user_metadata?.name as string | undefined) || (auth.data.user.email?.split('@')[0] ?? 'Administrador'),
    );
    if (!profile.active) throw new HttpError(401, 'Usuário inativo.');

    req.user = mapUser(profile);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Você não tem permissão para esta ação.' });
      return;
    }
    next();
  };
}

export const canWrite: Role[] = ['Administração', 'Técnico'];
export const canAdmin: Role[] = ['Administração'];
