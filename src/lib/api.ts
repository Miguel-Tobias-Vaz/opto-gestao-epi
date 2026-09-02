export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({} as { error?: unknown; message?: unknown }));
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me' && path !== '/auth/forgot' && path !== '/auth/reset') {
      window.dispatchEvent(new Event('opto:unauthorized'));
    }
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
          ? data.message
          : response.status === 502
            ? 'A API não respondeu. Confira se o npm run dev está no ar.'
            : 'Não foi possível concluir a operação.';
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<{ user: import('@/types').AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: import('@/types').AuthUser | null }>('/auth/me'),
  forgotPassword: (email: string) => request('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (accessToken: string, refreshToken: string, password: string) =>
    request<{ user: import('@/types').AuthUser }>('/auth/reset', { method: 'POST', body: JSON.stringify({ accessToken, refreshToken, password }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  users: {
    list: () => request<import('@/types').SystemUser[]>('/users'),
    create: (body: object) => request<import('@/types').SystemUser>('/users', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').SystemUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  employees: {
    list: () => request<import('@/types').Employee[]>('/employees'),
    create: (body: object) => request<import('@/types').Employee>('/employees', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  epis: {
    list: () => request<import('@/types').Epi[]>('/epis'),
    create: (body: object) => request<import('@/types').Epi>('/epis', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: object) => request<import('@/types').Epi>(`/epis/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
  movements: {
    list: () => request<import('@/types').Movement[]>('/movements'),
    create: (body: object) => request<import('@/types').Movement>('/movements', { method: 'POST', body: JSON.stringify(body) }),
  },
  dashboard: () => request<import('@/types').DashboardData>('/dashboard'),
  inventory: {
    current: () => request<import('@/types').InventorySession | null>('/inventory'),
    start: () => request<import('@/types').InventorySession>('/inventory', { method: 'POST' }),
    count: (id: string, found: number) => request(`/inventory/items/${id}`, { method: 'PATCH', body: JSON.stringify({ found }) }),
    close: (id: string) => request<import('@/types').InventorySession>(`/inventory/${id}/close`, { method: 'POST' }),
  },
};
