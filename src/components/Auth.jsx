import { useState, useEffect } from 'react';
import { sanitizeText, sanitizeObject } from '../utils/sanitize';
import { login as apiLogin, register as apiRegister, getEnrolledStudent } from '../utils/api';

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
  const [authDetails, setAuthDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enrolledInfo, setEnrolledInfo] = useState(null);

  // Auto-lookup enrolled student info when regNo changes in signup view
  useEffect(() => {
    if (view === 'studentSignup' && formData.regNo.trim()) {
      const enrolled = getEnrolledStudent(formData.regNo.trim());
      setEnrolledInfo(enrolled);
      if (enrolled) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || enrolled.name || '',
          dept: prev.dept || enrolled.dept || '',
          year: prev.year || enrolled.year || 1
        }));
      }
    } else {
      setEnrolledInfo(null);
    }
  }, [formData.regNo, view]);

  const switchView = (newView, overrideReg = null) => {
    setView(newView);
    setError('');
    setAuthDetails(null);
    const targetPath = newView === 'adminLogin' ? '/admin' : '/student/login';
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', targetPath);
    }
    if (onNavigate) {
      onNavigate(targetPath);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
    if (authDetails) setAuthDetails(null);
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setAuthDetails(null);
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
      setAuthDetails({
        code: err.code || 'INVALID_ADMIN',
        message: err.message || 'Invalid admin credentials'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSignup = async (e) => {
    e.preventDefault();
    setError('');
    setAuthDetails(null);

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
      setError(err.message || 'Registration failed');
      setAuthDetails({
        code: err.code || 'REG_FAILED',
        regNo: formData.regNo,
        officialName: err.officialName,
        enteredName: err.enteredName,
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');
    setAuthDetails(null);
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
      setAuthDetails({
        code: err.code || 'AUTH_FAILED',
        regNo: formData.regNo,
        enrolledStudent: err.enrolledStudent || getEnrolledStudent(formData.regNo),
        studentName: err.studentName || (err.enrolledStudent && err.enrolledStudent.name),
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const activateEnrolledStudent = (student) => {
    setFormData(prev => ({
      ...prev,
      regNo: student.regNo || prev.regNo,
      name: student.name || '',
      dept: student.dept || '',
      year: student.year || 1,
      password: '',
      confirmPassword: ''
    }));
    switchView('studentSignup');
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

        {/* --- GENERATIVE VERIFICATION & SECURITY ALERT CARD --- */}
        {error && (
          <div className="mb-6 space-y-3">
            {authDetails?.code === 'STUDENT_NOT_REGISTERED' ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                    Enrolled Student Detected · Not Activated
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Name:</span>
                    <span className="font-bold text-slate-800 dark:text-amber-200">
                      {authDetails.enrolledStudent?.name || authDetails.studentName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Register Number:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-white">
                      {authDetails.regNo}
                    </span>
                  </div>
                  {authDetails.enrolledStudent?.dept && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department & Year:</span>
                      <span className="font-semibold text-slate-700 dark:text-white">
                        {authDetails.enrolledStudent.dept} · Year {authDetails.enrolledStudent.year}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-3 leading-relaxed">
                  You are officially enrolled in the institution database. To access your seating slip, activate your account by setting your secure password.
                </p>
                <button
                  type="button"
                  onClick={() => activateEnrolledStudent(authDetails.enrolledStudent || { regNo: authDetails.regNo, name: authDetails.studentName })}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-xs rounded-xl shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span>👉 Activate Account as {authDetails.enrolledStudent?.name || authDetails.studentName}</span>
                </button>
              </div>
            ) : authDetails?.code === 'UNAUTHORIZED_STUDENT' ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
                    Unauthorized / Fake Register Number Blocked
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-red-500/20 text-xs space-y-1 mb-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Attempted Number:</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-300">
                      {authDetails.regNo}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Verification Status:</span>
                    <span className="text-red-500 font-semibold">NOT ENROLLED / UNRECOGNIZED</span>
                  </div>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                  No institutional record was found for this register number. Random or fake registration numbers are strictly prevented from logging in.
                </p>
              </div>
            ) : authDetails?.code === 'NAME_MISMATCH' ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Identity Verification: Name Mismatch
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-black/30 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Official Database Name:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {authDetails.officialName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Entered Name:</span>
                    <span className="font-bold text-red-500 line-through">
                      {authDetails.enteredName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, name: authDetails.officialName }));
                    setError('');
                    setAuthDetails(null);
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
                >
                  ✓ Use Official Name ("{authDetails.officialName}")
                </button>
              </div>
            ) : authDetails?.code === 'INVALID_PASSWORD' ? (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Incorrect Password for Registered Student
                  </span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed mb-1">
                  The password entered does not match the registered account for <strong className="font-semibold">{authDetails.studentName}</strong> ({authDetails.regNo}).
                </p>
                <span className="text-[11px] text-slate-500">Please re-enter your password carefully.</span>
              </div>
            ) : (
              <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}
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
              <label className="block text-xs font-bold text-slate-500 mb-1">Register Number</label>
              <input
                type="text"
                name="regNo"
                value={formData.regNo}
                onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50 uppercase font-mono"
                placeholder="e.g. 2117240080068"
                required
              />
              {enrolledInfo ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-medium">
                  <span>✓</span>
                  <span>
                    Verified Student: <strong>{enrolledInfo.name}</strong> ({enrolledInfo.dept}, Year {enrolledInfo.year})
                  </span>
                </div>
              ) : formData.regNo.trim().length >= 4 ? (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                  <span>ℹ️</span>
                  <span>Checking register number against enrolled database...</span>
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Full Name (as per college records)</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                placeholder="e.g. LOKESH G"
                required
              />
              {enrolledInfo && formData.name.trim() && enrolledInfo.name.toLowerCase() !== formData.name.trim().toLowerCase() && (
                <div className="mt-1 text-[11px] text-amber-700">
                  ⚠️ Note: Enrolled college record name is <strong>{enrolledInfo.name}</strong>.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Department</label>
                <input
                  type="text"
                  name="dept"
                  placeholder="e.g. CSBS"
                  value={formData.dept}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50 uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Year</label>
                <input
                  type="number"
                  name="year"
                  min="1"
                  max="5"
                  value={formData.year}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Create Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Activate & Create Account
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
