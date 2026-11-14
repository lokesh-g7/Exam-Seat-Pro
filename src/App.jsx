import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import NotFoundPage from './components/NotFoundPage';
import PortalLanding from './components/PortalLanding';
import { getStoredUser, setStoredUser, removeStoredUser, removeStoredToken } from './utils/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    // 1. Load authenticated user from storage
    try {
      const stored = getStoredUser();
      if (stored && stored.role) {
        setUser({
          ...stored,
          role: stored.role.toLowerCase()
        });
      }
    } catch {
      removeStoredUser();
    }
    setIsLoading(false);

    // 2. Listen to browser popstate (Back / Forward navigation)
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);

    // 3. Listen to expired session event
    const handleAuthExpired = () => {
      setUser(null);
      removeStoredUser();
      removeStoredToken();
      navigate('/student/login');
    };
    window.addEventListener('auth:expired', handleAuthExpired);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  const navigate = (path) => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  const handleLogin = (userData, redirectPath) => {
    const normalized = {
      ...userData,
      role: (userData.role || '').toLowerCase()
    };
    setUser(normalized);
    setStoredUser(normalized);
    if (redirectPath) {
      navigate(redirectPath);
    } else if (normalized.role === 'admin') {
      navigate('/admin');
    } else {
      const reg = normalized.regNo || normalized.username || '';
      navigate(`/student/reg=${encodeURIComponent(reg)}`);
    }
  };

  const handleLogout = () => {
    const wasAdmin = user && user.role === 'admin';
    setUser(null);
    removeStoredUser();
    removeStoredToken();
    if (wasAdmin) {
      navigate('/admin');
    } else {
      navigate('/student/login');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Normalize path (strip query params and trailing slash)
  const rawPath = currentPath.split('?')[0];
  const normalizedPath = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Unified Portal Gateway Landing (Root /)
  // ─────────────────────────────────────────────────────────────────────────────
  if (normalizedPath === '/' || normalizedPath === '' || normalizedPath === '/index.html') {
    return (
      <PortalLanding
        user={user}
        onSelectPortal={(path) => navigate(path)}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Admin Gateway Route (/admin)
  // ─────────────────────────────────────────────────────────────────────────────
  if (normalizedPath === '/admin') {
    // If not logged in -> Show Admin Login
    if (!user) {
      return (
        <Auth
          initialView="adminLogin"
          onLogin={handleLogin}
          onNavigate={(p) => setCurrentPath(p)}
        />
      );
    }

    // If logged in as admin -> Grant access to Admin Dashboard
    if (user.role === 'admin') {
      return <AdminDashboard onLogout={handleLogout} />;
    }

    // Role Escalation / Cross-Portal Protection:
    // If a student tries to access /admin with their student token, strictly block!
    return (
      <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-3xl">
            🛡️
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-red-400">Restricted Access</h2>
            <p className="text-white/60 text-sm">
              Admin privileges are required to access this gateway. You are currently authenticated as student{' '}
              <span className="font-mono text-amber-400 font-bold">{user.regNo || user.username}</span>.
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
            Anti-tampering security active: Student accounts cannot access or inspect administrative controls.
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate(`/student/reg=${encodeURIComponent(user.regNo || user.username)}`)}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all text-sm"
            >
              Go to My Student Portal
            </button>
            <button
              onClick={handleLogout}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/10 transition-all text-xs font-semibold"
            >
              Sign Out & Use Admin Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Student Portal - Pre-Login (/student or /student/login)
  // ─────────────────────────────────────────────────────────────────────────────
  if (normalizedPath === '/student' || normalizedPath === '/student/login') {
    // If student is already logged in, redirect straight to their unique reg seating
    if (user && user.role === 'student') {
      const studentReg = user.regNo || user.username || '';
      navigate(`/student/reg=${encodeURIComponent(studentReg)}`);
      return null;
    }

    return (
      <Auth
        initialView="studentLogin"
        onLogin={handleLogin}
        onNavigate={(p) => setCurrentPath(p)}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Student Portal - Allocated Seating (/student/reg=:regNo)
  // ─────────────────────────────────────────────────────────────────────────────
  const studentRegMatch = normalizedPath.match(/^\/student\/reg=([^/?#]+)$/i);
  if (studentRegMatch) {
    const targetRegNo = decodeURIComponent(studentRegMatch[1]);

    // Unauthenticated user attempting to view a seat allocation -> require login
    if (!user) {
      return (
        <Auth
          initialView="studentLogin"
          initialRegNo={targetRegNo}
          errorNotice={`Please sign in with your credentials to view exam seating for registration number ${targetRegNo}.`}
          onLogin={handleLogin}
          onNavigate={(p) => setCurrentPath(p)}
        />
      );
    }

    // Case A: Authenticated Student
    if (user.role === 'student') {
      const currentStudentReg = (user.regNo || user.username || '').trim().toUpperCase();
      const requestedReg = targetRegNo.trim().toUpperCase();

      // Anti-Tampering Check: Student cannot view another student's seat allocation
      if (currentStudentReg !== requestedReg) {
        return (
          <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white/5 border border-amber-500/30 rounded-3xl p-8 backdrop-blur-xl text-center space-y-6 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl">
                ⚠️
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-amber-400">Data Isolation Active</h2>
                <p className="text-white/60 text-sm">
                  You are signed in as <span className="font-mono text-amber-300 font-bold">{user.regNo}</span>.
                  You cannot view the seating arrangement for another student (<span className="font-mono text-white/80">{targetRegNo}</span>).
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => navigate(`/student/reg=${encodeURIComponent(user.regNo)}`)}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                >
                  Return to My Seating Record
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/10 transition-all text-xs font-semibold"
                >
                  Sign Out / Switch Student
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Valid student viewing their own seating
      return <StudentDashboard user={user} onLogout={handleLogout} />;
    }

    // Case B: Authenticated Admin inspecting a specific student's seating
    if (user.role === 'admin') {
      return (
        <StudentDashboard
          user={{ ...user, targetRegNo }}
          onLogout={handleLogout}
        />
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Unrecognized Path -> Standalone Custom 404
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <NotFoundPage
      onNavigateHome={() => navigate('/')}
      onLogout={handleLogout}
      user={user}
    />
  );
}
