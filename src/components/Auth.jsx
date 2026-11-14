import { useState } from 'react';
import { sanitizeText, sanitizeObject } from '../utils/sanitize';
import { login as apiLogin, register as apiRegister } from '../utils/api';

export default function Auth({
  onLogin,
  initialView = 'studentLogin',
  initialRegNo = '',
  errorNotice = '',
  onNavigate
}) {
  const [view, setView] = useState(initialView);
  // 'studentLogin' | 'studentSignup' | 'adminLogin'

  const [formData, setFormData] = useState({
    name: '',
    regNo: initialRegNo || '',  // registration number (used as username for students)
    dept: '',
    year: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState(errorNotice || '');
  const [loading, setLoading] = useState(false);

  const switchView = (newView) => {
    setView(newView);
    setError('');
    const targetPath = newView === 'adminLogin' ? '/admin' : '/student/login';
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', targetPath);
    }
    if (onNavigate) {
      onNavigate(targetPath);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sanitizedUsername = sanitizeText(formData.regNo || 'admin');
      const { token, user } = await apiLogin(sanitizedUsername, formData.password);
      if (user.role && user.role.toLowerCase() !== 'admin') {
        setError('Access Denied: This account does not possess admin clearance.');
        return;
      }
      localStorage.setItem('examseat_token', token);
      onLogin({ ...user, token, role: 'admin' }, '/admin');
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const sanitizedReg = sanitizeText(formData.regNo).trim();
      const sanitizedPayload = {
        username: sanitizedReg,
        password: formData.password,
        name: sanitizeText(formData.name),
        dept: sanitizeText(formData.dept),
        year: formData.year ? parseInt(formData.year) : 1,
        regNo: sanitizedReg,
        role: 'student',
      };
      const { token, user } = await apiRegister(sanitizedPayload);
      localStorage.setItem('examseat_token', token);
      const studentReg = sanitizedPayload.regNo || user.regNo || sanitizedReg;
      onLogin({ ...user, token, role: 'student', regNo: studentReg }, `/student/reg=${encodeURIComponent(studentReg)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sanitizedRegNo = sanitizeText(formData.regNo).trim();
      const { token, user } = await apiLogin(sanitizedRegNo, formData.password);
      if (user.role && user.role.toLowerCase() === 'admin') {
        setError('This is an administrator account. Please use Admin Gateway at /admin.');
        return;
      }
      localStorage.setItem('examseat_token', token);
      const studentReg = user.regNo || sanitizedRegNo;
      onLogin({ ...user, token, role: 'student', regNo: studentReg }, `/student/reg=${encodeURIComponent(studentReg)}`);
    } catch (err) {
      setError(err.message || 'Invalid student credentials');
    } finally {
      setLoading(false);
    }
  };

  const isDark = view === 'adminLogin';

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark ? 'bg-surface-950 text-white' : 'bg-gradient-to-br from-amber-50 via-orange-100 to-yellow-200 text-surface-900'}`}>
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
          </>
        ) : (
          <>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />
          </>
        )}
      </div>

      <div className={`relative z-10 w-full max-w-md p-8 rounded-3xl shadow-2xl backdrop-blur-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white/60 border-white/40 shadow-orange-500/10'}`}>
        <div className="text-center mb-8">
          <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center font-bold text-lg mb-4 shadow-lg ${isDark ? 'bg-gradient-to-br from-primary-500 to-purple-600 text-white shadow-primary-500/20' : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/30'}`}>
            EP
          </div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            {view === 'adminLogin' ? 'Admin Gateway' : view === 'studentLogin' ? 'Student Portal' : 'Create Account'}
          </h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            {view === 'adminLogin' ? 'Sign in to manage seating' : 'Access your exam seat allocation'}
          </p>
        </div>

        {error && (
          <div className={`mb-6 p-3 rounded-lg text-sm flex items-start gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* --- ADMIN LOGIN --- */}
        {view === 'adminLogin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1">Admin Username</label>
              <input type="text" name="regNo" value={formData.regNo} onChange={handleChange}
                className="input-field w-full" placeholder="admin" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange}
                className="input-field w-full" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Sign In as Admin
            </button>
          </form>
        )}

        {/* --- STUDENT LOGIN --- */}
        {view === 'studentLogin' && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Register Number</label>
              <input type="text" name="regNo" value={formData.regNo} onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                placeholder="e.g. 22CS001" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Sign In to Portal
            </button>
          </form>
        )}

        {/* --- STUDENT SIGNUP --- */}
        {view === 'studentSignup' && (
          <form onSubmit={handleStudentSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Register Number</label>
              <input type="text" name="regNo" value={formData.regNo} onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                placeholder="e.g. 22CS001" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
                <input type="text" name="dept" placeholder="e.g. CSE" value={formData.dept} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Year</label>
                <input type="number" name="year" min="1" max="5" value={formData.year} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Confirm</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  required />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Create Account
            </button>
          </form>
        )}

        {/* View Switcher */}
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-white/10' : 'border-slate-200/50'} text-center text-sm`}>
          {view === 'adminLogin' ? (
            <button type="button" onClick={() => switchView('studentLogin')} className="text-primary-400 hover:text-primary-300 transition-colors">
              I'm a student
            </button>
          ) : (
            <div className="space-y-2">
              <div>
                <span className="text-slate-500">
                  {view === 'studentLogin' ? "Don't have an account? " : "Already registered? "}
                </span>
                <button
                  type="button"
                  onClick={() => switchView(view === 'studentLogin' ? 'studentSignup' : 'studentLogin')}
                  className="text-orange-500 font-semibold hover:text-orange-600 transition-colors"
                >
                  {view === 'studentLogin' ? 'Sign Up' : 'Sign In'}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => switchView('adminLogin')}
                  className="text-slate-400 hover:text-slate-600 font-semibold transition-colors mt-2 text-xs"
                >
                  Admin login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
