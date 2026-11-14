/**
 * Centralized API & Authentication Client
 * Provides token storage, authenticated fetch helpers, and global request interceptors.
 */

const API_URL = '/api';

export function getStoredToken() {
  try {
    return localStorage.getItem('examseat_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem('examseat_token', token);
    else localStorage.removeItem('examseat_token');
  } catch {}
}

export function removeStoredToken() {
  try {
    localStorage.removeItem('examseat_token');
  } catch {}
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('examseat_pro_auth') || localStorage.getItem('examseat_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  try {
    if (user) {
      localStorage.setItem('examseat_pro_auth', JSON.stringify(user));
      localStorage.setItem('examseat_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('examseat_pro_auth');
      localStorage.removeItem('examseat_user');
    }
  } catch {}
}

export function removeStoredUser() {
  try {
    localStorage.removeItem('examseat_pro_auth');
    localStorage.removeItem('examseat_user');
  } catch {}
}

/**
 * Authenticated Fetch wrapper
 * Automatically injects the Authorization Bearer header if a token is present.
 */
export async function authFetch(url, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set default JSON Content-Type only if body is not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  // Handle unauthorized (expired token)
  if (response.status === 401) {
    removeStoredToken();
    removeStoredUser();
    // Dispatch custom auth-expired event for clean UI handling
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  return response;
}

// ─── Global Fetch Interceptor ────────────────────────────────────────────────
// Ensures all existing fetch('/api/...') calls automatically carry the JWT token
if (typeof window !== 'undefined' && !window.__examseat_fetch_intercepted__) {
  window.__examseat_fetch_intercepted__ = true;
  const originalFetch = window.fetch;

  window.fetch = async function (resource, config = {}) {
    let url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';

    if (url.startsWith('/api/') || url.includes('/api/')) {
      const token = getStoredToken();
      if (token) {
        config = config || {};
        const headers = new Headers(config.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
          config.headers = headers;
        }
      }
    }

    const response = await originalFetch(resource, config);

    // Auto-detect 401 on /api/ calls
    if (response.status === 401 && (url.startsWith('/api/') || url.includes('/api/')) && !url.includes('/api/auth/login')) {
      removeStoredToken();
      removeStoredUser();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    return response;
  };
}

// ─── Auth API Functions ───────────────────────────────────────────────────────

export async function login(username, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Authentication failed');
  }

  return res.json();
}

export async function register(userData) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Registration failed');
  }

  return res.json();
}

export async function validateToken(token) {
  const res = await fetch(`${API_URL}/auth/validate`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.json();
}
