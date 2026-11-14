import React from 'react';

export default function NotFoundPage({ onNavigateHome, onLogout, user }) {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  const handleGoHome = () => {
    if (typeof window !== 'undefined' && window.history && window.history.pushState) {
      window.history.pushState({}, '', '/');
    }
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background glow orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Brand / Shield Header */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary-400 mb-6 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          SYSTEM CODE: 404_NOT_FOUND
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle grid watermark */}
          <div className="absolute -top-12 -right-12 text-[180px] font-black text-white/[0.02] select-none pointer-events-none font-mono">
            404
          </div>

          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 via-orange-500/20 to-primary-500/20 border border-white/10 flex items-center justify-center shadow-lg shadow-red-500/10">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-3">
            Coordinate Not Found
          </h1>

          <p className="text-sm text-white/50 leading-relaxed max-w-md mx-auto mb-6">
            The examination hall, seat allocation, or administrative route you requested does not exist or is protected under restricted clearance.
          </p>

          {/* Requested route chip */}
          <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-xs text-white/60 mb-8 inline-block max-w-full truncate">
            Path: <span className="text-primary-300">{currentPath}</span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleGoHome}
              className="btn-primary py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20 text-sm font-bold"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {user ? 'Return to Portal' : 'Return to Login'}
            </button>

            {user && (
              <button
                onClick={onLogout}
                className="btn-secondary py-3.5 px-6 rounded-xl text-sm font-semibold text-white/60 hover:text-white"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-xs text-white/20 mt-6 font-mono">
          ExamSeat Pro Secure Gateway · Protected Session
        </p>
      </div>
    </div>
  );
}

