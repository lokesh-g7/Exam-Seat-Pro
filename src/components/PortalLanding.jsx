import React from 'react';

export default function PortalLanding({ onSelectPortal, user }) {
  const navigate = (path) => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({}, '', path);
    }
    if (onSelectPortal) {
      onSelectPortal(path);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[180px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl text-center space-y-8">
        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-primary-300 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          EXAMSEAT PRO · SECURE MULTI-PORTAL GATEWAY
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
            Choose Your Portal
          </h1>
          <p className="text-white/50 text-sm sm:text-base max-w-xl mx-auto">
            Autonomous seating allocation, real-time conflict avoidance, and instant student hall discovery.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 text-left">
          {/* Student Portal Card */}
          <div
            onClick={() => navigate('/student/login')}
            className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-amber-500/50 rounded-3xl p-8 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-black mb-6 shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
                🎓
              </div>
              <span className="text-[11px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                Student Access
              </span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-2">
                Student Portal
              </h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Log in with your registration number to view assigned examination halls, seat numbers, bench rows, and timetable slips.
              </p>
            </div>

            <div className="pt-8">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                <span>Enter Student Portal</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
              <div className="text-[11px] font-mono text-white/30 mt-1">
                Route: <span className="text-white/50">/student/login</span>
              </div>
            </div>
          </div>

          {/* Admin Gateway Card */}
          <div
            onClick={() => navigate('/admin')}
            className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-primary-500/50 rounded-3xl p-8 transition-all duration-300 cursor-pointer shadow-xl hover:shadow-primary-500/10 flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black mb-6 shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
                🛡️
              </div>
              <span className="text-[11px] font-mono tracking-widest text-primary-400 uppercase font-bold">
                Restricted Clearance
              </span>
              <h2 className="text-2xl font-bold text-white mt-1 mb-2">
                Admin Gateway
              </h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Configure exam halls, upload nominal rolls, generate zero-conflict seating with parity shift algorithms, and publish official allocations.
              </p>
            </div>

            <div className="pt-8">
              <div className="flex items-center gap-2 text-sm font-bold text-primary-400 group-hover:text-primary-300 transition-colors">
                <span>Enter Admin Gateway</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
              <div className="text-[11px] font-mono text-white/30 mt-1">
                Route: <span className="text-white/50">/admin</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-white/25 font-mono pt-4">
          ExamSeat Pro Secure Multi-Tenant Architecture · Vercel Production Build
        </p>
      </div>
    </div>
  );
}
