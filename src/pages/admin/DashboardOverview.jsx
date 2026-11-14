import { useState, useEffect } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { countAllConflicts, calculateConflicts, calculateSQI } from '../../utils/seatingEngine'

export default function DashboardOverview() {
  const { students, timetable, seating, config } = useAdmin()
  const [halls, setHalls] = useState([])
  const [depts, setDepts] = useState([])
  const [subjects, setSubjects] = useState([])
  const [versions, setVersions] = useState([])
  const [invigilators, setInvigilators] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchTelemetry() {
      try {
        const [hallsRes, deptsRes, subjectsRes, versionsRes, invigRes] = await Promise.all([
          fetch('/api/halls'),
          fetch('/api/departments'),
          fetch('/api/subjects'),
          fetch('/api/seating-versions'),
          fetch('/api/invigilators')
        ])

        if (hallsRes.ok) setHalls(await hallsRes.json())
        if (deptsRes.ok) setDepts(await deptsRes.json())
        if (subjectsRes.ok) setSubjects(await subjectsRes.json())
        if (versionsRes.ok) setVersions(await versionsRes.json())
        if (invigRes.ok) setInvigilators(await invigRes.json())
      } catch (err) {
        console.error("Telemetry fetch error:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTelemetry()
  }, [students, timetable, seating])

  const totalConflicts = seating.length > 0 ? countAllConflicts(seating, config.mode) : 0
  const allConflicts = seating.flatMap(grid => calculateConflicts(grid, config.mode))
  const { sqi, rating } = calculateSQI(allConflicts)

  // Calculate capacity
  const totalCapacity = halls.reduce((sum, h) => {
    const seats = h.seatsPerTable || 1
    const mult = (config.mode === 'internal' && seats >= 2) ? 2 : 1
    const totalPos = (h.rowsCount || 8) * (h.columnsCount || 4)
    // Roughly estimate usable positions
    const blockedCount = h.blockedSeats ? h.blockedSeats.split(',').length : 0
    return sum + ((totalPos - blockedCount) * mult)
  }, 0)

  return (
    <div className="space-y-8 animate-in text-white">
      {/* Welcome & Status summary */}
      <div className="bg-gradient-to-r from-primary-950 via-surface-900 to-surface-950 border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none" />
        <p className="text-primary-400 font-bold text-xs uppercase tracking-widest mb-1">Operational Telemetry</p>
        <h2 className="text-3xl font-black tracking-tight">System Status Overview</h2>
        <p className="text-white/40 text-sm mt-1 max-w-xl">
          Real-time summary of loaded students, active timetables, hall layout configurations, and seating integrity scores.
        </p>
      </div>

      {/* Primary Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 flex flex-col justify-between h-36">
          <div>
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block">Students Loaded</span>
            <span className="text-3xl font-black mt-2 block">{students.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-2">
            <span>Validation warnings:</span>
            <span className={students.some(s => !s.dept || s.dept === 'Unknown') ? "text-amber-400 font-bold" : "text-green-400 font-bold"}>
              {students.filter(s => !s.dept || s.dept === 'Unknown').length}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between h-36">
          <div>
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block">Halls Available</span>
            <span className="text-3xl font-black text-primary-400 mt-2 block">{halls.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-2">
            <span>Effective capacity:</span>
            <span className="text-white/80 font-mono font-bold">{totalCapacity || '—'} seats</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between h-36">
          <div>
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block">Exam Papers</span>
            <span className="text-3xl font-black text-purple-400 mt-2 block">{timetable.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-2">
            <span>Active departments:</span>
            <span className="text-white/80 font-bold">{depts.length}</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between h-36">
          <div>
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider block">Seating Status</span>
            {seating.length > 0 ? (
              <span className={`text-3xl font-black mt-2 block ${totalConflicts === 0 ? "text-green-400" : "text-amber-400"}`}>
                {totalConflicts === 0 ? "Perfect" : `${totalConflicts} Conflicts`}
              </span>
            ) : (
              <span className="text-3xl font-black text-white/20 mt-2 block">Unassigned</span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-white/30 border-t border-white/5 pt-2">
            <span>Integrity Score (SQI):</span>
            <span className="text-white/80 font-bold">{seating.length > 0 ? `${Math.round(sqi)}%` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Split view for history, alerts, and pending approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Validation Warnings & Alerts */}
        <div className="glass-card p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="font-black text-lg tracking-tight">Active Validation & Integrity Checks</h3>
            <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 uppercase font-black">Preflight</span>
          </div>

          <div className="space-y-4">
            {students.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-400 text-sm">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-bold">No Students Registered</p>
                  <p className="text-white/50 text-xs mt-0.5">Please import the student CSV spreadsheet in the Master Data module to get started.</p>
                </div>
              </div>
            )}

            {timetable.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-amber-400 text-sm">
                <span className="text-lg">📅</span>
                <div>
                  <p className="font-bold">No Timetable Blueprint Uploaded</p>
                  <p className="text-white/50 text-xs mt-0.5">Upload a text-based or scanned PDF timetable blueprint to configure exam sessions.</p>
                </div>
              </div>
            )}

            {halls.length === 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3 text-red-400 text-sm">
                <span className="text-lg">🏛️</span>
                <div>
                  <p className="font-bold">No Exam Halls Configured</p>
                  <p className="text-white/50 text-xs mt-0.5">Ensure at least one active hall is defined in database to generate seat assignments.</p>
                </div>
              </div>
            )}

            {students.length > 0 && timetable.length > 0 && halls.length > 0 && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex gap-3 text-green-400 text-sm">
                <span className="text-lg">✅</span>
                <div>
                  <p className="font-bold">All Master Data Verified</p>
                  <p className="text-white/50 text-xs mt-0.5">Students, timetable schedules, and active hall layouts are loaded and verified. Ready to generate seating configurations.</p>
                </div>
              </div>
            )}

            {seating.length > 0 && totalConflicts > 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3 text-red-400 text-sm">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-bold">Active Conflicts Requiring Attention</p>
                  <p className="text-white/50 text-xs mt-0.5">There are same-subject adjacent or diagonal seating violations. Go to Allocation and run standard regeneration.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Seating Versions History */}
        <div className="glass-card p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="font-black text-lg tracking-tight">Recent Seating Seeds</h3>
            <span className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/40 uppercase font-black">History</span>
          </div>

          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {versions.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-sm">
                No saved seating versions found.
              </div>
            ) : (
              versions.slice(0, 6).map((v) => (
                <div key={v.id} className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs space-y-2 hover:border-primary-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white/90">Version V{v.version}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${
                      v.status === 'PUBLISHED' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    }`}>{v.status}</span>
                  </div>
                  <div className="space-y-1 text-white/40">
                    <div className="flex justify-between">
                      <span>Seed:</span>
                      <span className="font-mono text-white/70">{v.seed || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Uploader:</span>
                      <span className="text-white/70">{v.creator || 'admin'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Generated:</span>
                      <span className="text-white/70">{new Date(v.timestamp).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
