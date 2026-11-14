import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import NotFoundPage from './components/NotFoundPage';
import { getStoredUser, setStoredUser, removeStoredUser, removeStoredToken } from './utils/api';

const VALID_PATHS = new Set(['/', '', '/index.html']);

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    // 1. Load authenticated user
    try {
      const stored = getStoredUser();
      if (stored && stored.role) {
        setUser(stored);
      }
    } catch {
      removeStoredUser();
    }
    setIsLoading(false);

    // 2. Listen to browser history changes (popstate)
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);

    // 3. Listen to expired session event from api.js
    const handleAuthExpired = () => {
      setUser(null);
      removeStoredUser();
      removeStoredToken();
    };
    window.addEventListener('auth:expired', handleAuthExpired);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('auth:expired', handleAuthExpired);
    };
  }, []);

  const handleLogin = (userData) => {
    const normalized = {
      ...userData,
      role: (userData.role || '').toLowerCase()
    };
    setUser(normalized);
    setStoredUser(normalized);
  };

  const handleLogout = () => {
    setUser(null);
    removeStoredUser();
    removeStoredToken();
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }
  };

  const handleNavigateHome = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // 404 Detection: if user is navigating to an unknown client path
  const isRecognizedPath = VALID_PATHS.has(currentPath) || currentPath === '';
  if (!isRecognizedPath) {
    return (
      <NotFoundPage
        onNavigateHome={handleNavigateHome}
        onLogout={handleLogout}
        user={user}
      />
    );
  }

  // Unauthenticated user -> Auth Gateway (Login / Signup)
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const role = (user.role || '').toLowerCase();

  // Role: Admin -> Protected Admin Dashboard
  if (role === 'admin') {
    return <AdminDashboard onLogout={handleLogout} />;
  }

  // Role: Student -> Student Portal
  if (role === 'student') {
    return <StudentDashboard user={user} onLogout={handleLogout} />;
  }

  // Fallback for unexpected or corrupted role -> 404 / Access Denied
  return (
    <NotFoundPage
      onNavigateHome={handleNavigateHome}
      onLogout={handleLogout}
      user={user}
    />
  );
}
