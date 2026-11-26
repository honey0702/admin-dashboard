/** JWT API client. */

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
// VITE_DEMO_MODE=true produces a fully offline build (seed data, no backend, no login).
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const API_BASE_URL = BASE;
export const isApiConfigured = !DEMO_MODE && Boolean(BASE);
export const apiMode = isApiConfigured ? 'live' : 'demo';

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function getToken() {
  try {
    return window.localStorage.getItem('rang-poster-co:token');
  } catch {
    return null;
  }
}

let refreshInFlight;
async function refreshSession() {
  if (!refreshInFlight) refreshInFlight = (async () => {
    const refresh = localStorage.getItem('rang-poster-co:refresh');
    if (!refresh) return null;
    const r = await fetch(new URL(`${BASE.replace(/\/$/, '')}/auth/refresh/`, window.location.origin), {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({refresh})});
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.data?.access) return null;
    localStorage.setItem('rang-poster-co:token', d.data.access);
    if (d.data.refresh) localStorage.setItem('rang-poster-co:refresh', d.data.refresh);
    return d.data.access;
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function apiFetch(path, { method = 'GET', body, params } = {}) {
  if (!isApiConfigured) {
    throw new ApiError('API is not configured. Set VITE_API_BASE_URL to enable live mode.', 0, null);
  }
  const url = new URL(`${BASE.replace(/\/$/, '')}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const token = getToken();
  let res = await fetch(url, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token && !path.startsWith('/auth/')) {
    const access = await refreshSession();
    if (access) res = await fetch(url, {method, headers:{...(body instanceof FormData ? {} : {'Content-Type':'application/json'}), Accept:'application/json', Authorization:`Bearer ${access}`}, body:body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined});
    if (res.status === 401) { localStorage.removeItem('rang-poster-co:token'); localStorage.removeItem('rang-poster-co:refresh'); window.dispatchEvent(new Event('session-expired')); }
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.detail || data?.message || data?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status, data);
  }
  return data?.success === true ? data.data : data;
}

export const api = {
  auth: {
    login: (username, password) => apiFetch('/auth/login/', { method: 'POST', body: { username, password } }),
    logout: (refresh) => apiFetch('/auth/logout/', { method: 'POST', body: { refresh } }),
    refresh: (refresh) => apiFetch('/auth/refresh/', { method: 'POST', body: { refresh } }),
    me: () => apiFetch('/auth/me/'),
  },
  inventory: {
    list: (params) => apiFetch('/designs/', { params }),
    create: (payload) => apiFetch('/designs/', { method: 'POST', body: payload }),
    update: (id, patch) => apiFetch(`/designs/${id}/`, { method: 'PATCH', body: patch }),
    archive: (id) => apiFetch(`/designs/${id}/archive/`, { method: 'POST' }),
    addBatch: (id, batch) => apiFetch(`/designs/${id}/batches/`, { method: 'POST', body: batch }),
    damage: (id, payload) => apiFetch(`/designs/${id}/damage/`, { method: 'POST', body: payload }),
  },
  sales: {
    list: (params) => apiFetch('/sales/', { params }),
    create: (payload) => apiFetch('/sales/', { method: 'POST', body: payload }),
    cancel: (id, reason) => apiFetch(`/sales/${id}/cancel/`, { method: 'POST', body: { reason } }),
  },
  expenses: {
    list: (params) => apiFetch('/expenses/', { params }),
    create: (payload) => apiFetch('/expenses/', { method: 'POST', body: payload }),
    update: (id, patch) => apiFetch(`/expenses/${id}/`, { method: 'PATCH', body: patch }),
    remove: (id) => apiFetch(`/expenses/${id}/`, { method: 'DELETE' }),
  },
  orders: {
    list: (params) => apiFetch('/orders/', { params }),
    create: (payload) => apiFetch('/orders/', { method: 'POST', body: payload }),
    update: (id, patch) => apiFetch(`/orders/${id}/`, { method: 'PATCH', body: patch }),
    setStatus: (id, status) => apiFetch(`/orders/${id}/status/`, { method: 'POST', body: { status } }),
    fulfill: (id, payload) => apiFetch(`/orders/${id}/fulfill/`, { method: 'POST', body: payload }),
  },
  discountRules: {
    list: () => apiFetch('/discount-rules/'),
    create: (payload) => apiFetch('/discount-rules/', { method: 'POST', body: payload }),
    update: (id, patch) => apiFetch(`/discount-rules/${id}/`, { method: 'PATCH', body: patch }),
    remove: (id) => apiFetch(`/discount-rules/${id}/`, { method: 'DELETE' }),
  },
  reports: {
    daily: (date) => apiFetch('/reports/daily/', { params: { date } }),
    summary: (from, to) => apiFetch('/reports/summary/', { params: { from, to } }),
  },
};
