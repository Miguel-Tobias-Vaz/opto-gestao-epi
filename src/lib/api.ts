export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'opto_access';

function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      'Não foi possível falar com o servidor. No PC, rode npm run dev. Na Vercel, confira as variáveis de ambiente.',
      0,
    );
  }

  const nextToken = response.headers.get('x-access-token');
  if (nextToken) setToken(nextToken);

  const data = await response.json().catch(() => ({} as { error?: unknown; message?: unknown; accessToken?: string }));
  if (typeof data.accessToken === 'string') setToken(data.accessToken);

  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me' && path !== '/auth/forgot' && path !== '/auth/reset') {
      setToken(null);
      window.dispatchEvent(new Event('opto:unauthorized'));
    }
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : response.status === 502 || response.status === 0
            ? 'A API não respondeu. No PC, rode npm run dev. Na Vercel, confira as variáveis de ambiente.'
            : 'Não foi possível concluir a operação.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<{ user: import('@/types').AuthUser; accessToken?: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (result.accessToken) setToken(result.accessToken);
    return result;
  },
  logout: async () => {
    await request('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
  },
  me: () => request<{ user: import('@/types').AuthUser | null }>('/auth/me'),
  forgotPassword: (email: string) => request('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: async (accessToken: string, refreshToken: string, password: string) => {
    const result = await request<{ user: import('@/types').AuthUser; accessToken?: string }>('/auth/reset', { method: 'POST', body: JSON.stringify({ accessToken, refreshToken, password }) });
    if (result.accessToken) setToken(result.accessToken);
    return result;
  },
  changePassword: async (currentPassword: string, newPassword: string) => {
    const result = await request<{ ok: boolean; accessToken?: string }>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    if (result.accessToken) setToken(result.accessToken);
    return result;
  },
  users: {
    list: () => request<import('@/types').SystemUser[]>('/users'),
    create: (body: object) => request<import('@/types').SystemUser>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').SystemUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  employees: {
    list: () => request<import('@/types').Employee[]>('/employees'),
    create: (body: object) => request<import('@/types').Employee>('/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    signatures: (id: string) => request<import('@/types').EmployeeSignature[]>(`/employees/${id}/signatures`),
    sign: (id: string, body: object) => request<import('@/types').EmployeeSignature>(`/employees/${id}/signatures`, { method: 'POST', body: JSON.stringify(body) }),
  },
  epis: {
    list: () => request<import('@/types').Epi[]>('/epis'),
    create: (body: object) => request<import('@/types').Epi>('/epis', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').Epi>(`/epis/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  movements: {
    list: () => request<import('@/types').Movement[]>('/movements'),
    create: (body: object) => request<{ movements: import('@/types').Movement[] }>('/movements', { method: 'POST', body: JSON.stringify(body) }),
  },
  dashboard: () => request<import('@/types').DashboardData>('/dashboard'),
  inventory: {
    current: () => request<import('@/types').InventorySession | null>('/inventory'),
    start: () => request<import('@/types').InventorySession>('/inventory', { method: 'POST' }),
    count: (id: string, found: number) => request(`/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify({ found }) }),
    close: (id: string) => request<import('@/types').InventorySession>(`/inventory/${id}/close`, { method: 'POST' }),
  },
};
