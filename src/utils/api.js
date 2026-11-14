/**
 * Centralized API & Authentication Client
 * Supports both Live Spring Boot Backend and Standalone Cloud Mode on Vercel.
 */

const RAW_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const API_URL = API_BASE ? `${API_BASE}/api` : '/api';

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
 * Safely parse JSON from a response, avoiding "Unexpected token 'T'" errors if HTML is returned.
 */
export async function safeParseJson(res) {
  if (!res) return null;
  const contentType = res.headers ? res.headers.get('content-type') || '' : '';
  if (contentType.includes('application/json')) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  return null;
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  return response;
}

// ─── Global Fetch Interceptor ────────────────────────────────────────────────
if (typeof window !== 'undefined' && !window.__examseat_fetch_intercepted__) {
  window.__examseat_fetch_intercepted__ = true;
  const originalFetch = window.fetch;

  window.fetch = async function (resource, config = {}) {
    let url = typeof resource === 'string' ? resource : resource instanceof Request ? resource.url : '';

    // If a remote API base is configured and URL starts with /api/, rewrite it
    if (API_BASE && url.startsWith('/api/')) {
      url = `${API_BASE}${url}`;
      if (typeof resource === 'string') {
        resource = url;
      }
    }

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

// ─── Enrolled Student Database Verification ──────────────────────────────────
export function getEnrolledStudent(regNo) {
  if (!regNo) return null;
  const clean = String(regNo).trim().toUpperCase();

  // 1. Check admin state students (uploaded via Excel / PDF / OCR / manual)
  try {
    const adminStorage = JSON.parse(localStorage.getItem('examseat_pro_admin_state') || '{}');
    const students = adminStorage.students || [];
    const match = students.find(s => (s.regNo || '').trim().toUpperCase() === clean);
    if (match) {
      return {
        regNo: match.regNo || clean,
        name: match.name || '',
        dept: match.dept || match.department || '',
        year: match.year || match.examYear || 1
      };
    }
  } catch {}

  // 2. Check published allocations (if allocations were synced)
  try {
    const published = JSON.parse(localStorage.getItem('examseat_published_allocations') || '[]');
    const match = published.find(s => (s.regNo || '').trim().toUpperCase() === clean);
    if (match) {
      return {
        regNo: match.regNo || clean,
        name: match.studentName || match.name || '',
        dept: match.dept || '',
        year: match.year || 1
      };
    }
  } catch {}

  return null;
}

// ─── Standalone Client Auth Fallback ──────────────────────────────────────────
// Strictly enforces authentication and registration verification
export function fallbackClientAuth(username, password) {
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();

  // 1. Admin Authentication
  if (cleanUser.toLowerCase() === 'admin') {
    if (cleanPass === 'admin123' || cleanPass === 'admin' || cleanPass === 'adminpassword123' || cleanPass === 'ChangeThisPasswordInProduction!') {
      return {
        token: 'standalone-jwt-admin-' + Date.now(),
        user: {
          id: 1,
          username: 'admin',
          name: 'Administrator',
          role: 'admin',
          dept: 'ADMIN',
          year: 0
        }
      };
    }
    const err = new Error('Invalid admin credentials. Access Denied.');
    err.code = 'INVALID_ADMIN_CREDENTIALS';
    throw err;
  }

  // 2. Student Authentication
  if (!cleanUser) {
    const err = new Error('Registration number is required.');
    err.code = 'MISSING_REGNO';
    throw err;
  }

  // Check locally registered accounts
  let registeredUser = null;
  try {
    const registered = JSON.parse(localStorage.getItem('examseat_registered_users') || '[]');
    registeredUser = registered.find(u => (u.username || u.regNo || '').trim().toUpperCase() === cleanUser.toUpperCase());
  } catch {}

  // IF NOT REGISTERED -> STRICTLY REJECT (NO AUTOMATIC LOGIN!)
  if (!registeredUser) {
    const enrolled = getEnrolledStudent(cleanUser);
    const err = new Error();
    if (enrolled && enrolled.name) {
      err.message = `Student "${enrolled.name}" (${cleanUser}) is enrolled in the official student database, but you have NOT created a portal account yet. Please switch to "Sign Up" to register your account and set your password.`;
      err.code = 'STUDENT_NOT_REGISTERED';
      err.enrolledStudent = enrolled;
      err.regNo = cleanUser;
    } else {
      err.message = `Registration number "${cleanUser}" is not registered or enrolled in the system. Fake or unauthorized registration numbers are strictly denied.`;
      err.code = 'UNAUTHORIZED_STUDENT';
      err.regNo = cleanUser;
    }
    throw err;
  }

  // IF REGISTERED -> VERIFY PASSWORD
  if (registeredUser.password && cleanPass !== registeredUser.password) {
    const err = new Error(`Incorrect password for ${registeredUser.name || cleanUser}. Please verify your credentials or reset your password.`);
    err.code = 'INVALID_PASSWORD';
    err.studentName = registeredUser.name || cleanUser;
    err.regNo = cleanUser;
    throw err;
  }

  // SUCCESSFUL AUTHENTICATION
  return {
    token: 'standalone-jwt-student-' + Date.now(),
    user: {
      ...registeredUser,
      role: 'student',
      regNo: registeredUser.regNo || cleanUser,
      name: registeredUser.name || cleanUser
    }
  };
}

// ─── Auth API Functions ───────────────────────────────────────────────────────

export async function login(username, password) {
  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '').trim();

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
    });

    const data = await safeParseJson(res);
    if (data) {
      if (!res.ok) {
        const err = new Error(data.error || 'Authentication failed');
        err.code = 'BACKEND_AUTH_ERROR';
        throw err;
      }
      return data;
    }
  } catch (err) {
    if (err.code === 'BACKEND_AUTH_ERROR') {
      throw err;
    }
  }

  // Fallback to strict client auth
  return fallbackClientAuth(cleanUsername, cleanPassword);
}

export async function register(userData) {
  const cleanReg = String(userData.regNo || userData.username || '').trim();
  const cleanName = String(userData.name || '').trim();

  // Try live backend first if available
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const data = await safeParseJson(res);
    if (data) {
      if (!res.ok) {
        const err = new Error(data.error || 'Registration failed');
        err.code = 'BACKEND_REG_ERROR';
        throw err;
      }
      return data;
    }
  } catch (err) {
    if (err.code === 'BACKEND_REG_ERROR') {
      throw err;
    }
  }

  // Standalone Verification:
  // 1. Check if already registered
  const registered = JSON.parse(localStorage.getItem('examseat_registered_users') || '[]');
  const alreadyRegistered = registered.find(u => (u.username || u.regNo || '').trim().toUpperCase() === cleanReg.toUpperCase());
  if (alreadyRegistered) {
    const err = new Error(`An account is already registered for ${alreadyRegistered.name || cleanReg} (${cleanReg}). Please switch to Sign In.`);
    err.code = 'ALREADY_REGISTERED';
    err.regNo = cleanReg;
    throw err;
  }

  // 2. Check if student is in the enrolled database
  const enrolled = getEnrolledStudent(cleanReg);
  let totalEnrolledCount = 0;
  try {
    const adminStorage = JSON.parse(localStorage.getItem('examseat_pro_admin_state') || '{}');
    totalEnrolledCount = (adminStorage.students || []).length;
  } catch {}

  if (totalEnrolledCount > 0 && !enrolled) {
    const err = new Error(`Registration number "${cleanReg}" was not found in the institution's enrolled student database. Fake or unregistered student accounts cannot be created.`);
    err.code = 'NOT_ENROLLED';
    err.regNo = cleanReg;
    throw err;
  }

  // 3. Name Verification if enrolled in official database
  if (enrolled && enrolled.name) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const enteredNorm = normalize(cleanName);
    const officialNorm = normalize(enrolled.name);

    const matches = enteredNorm.includes(officialNorm) || officialNorm.includes(enteredNorm) ||
                    cleanName.split(' ')[0].toLowerCase() === enrolled.name.split(' ')[0].toLowerCase();
    if (!matches && enteredNorm !== officialNorm) {
      const err = new Error(`Identity Verification Failed: Registration number ${cleanReg} officially belongs to "${enrolled.name}" according to college records. You entered "${cleanName}". Please enter the official name.`);
      err.code = 'NAME_MISMATCH';
      err.officialName = enrolled.name;
      err.enteredName = cleanName;
      err.regNo = cleanReg;
      throw err;
    }
  }

  // Save student registration locally
  const cleanUser = {
    ...userData,
    name: (enrolled && enrolled.name) ? enrolled.name : cleanName,
    dept: (enrolled && enrolled.dept) ? enrolled.dept : (userData.dept || 'CSBS'),
    year: (enrolled && enrolled.year) ? enrolled.year : (userData.year || 1),
    id: Date.now(),
    role: 'student',
    regNo: cleanReg
  };

  registered.push(cleanUser);
  localStorage.setItem('examseat_registered_users', JSON.stringify(registered));

  return {
    token: 'standalone-jwt-student-' + Date.now(),
    user: cleanUser
  };
}

export async function validateToken(token) {
  try {
    const res = await fetch(`${API_URL}/auth/validate`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await safeParseJson(res);
    if (data) return data;
  } catch {}
  return { valid: true };
}
