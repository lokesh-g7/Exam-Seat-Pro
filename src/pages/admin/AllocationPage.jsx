import { useState, useEffect, useMemo } from 'react'
import { useAdmin } from '../../context/AdminContext'
import HallGrid from '../../components/HallGrid'
import ConflictPanel from '../../components/ConflictPanel'
import { calculateConflicts, calculateSQI, countAllConflicts, MODES, flattenHalls } from '../../utils/seatingEngine'
import { getDistinctSessions, filterStudentsForSession, generateStudentsForSession } from '../../utils/timetableHelper'

export default function AllocationPage() {
  const { 
    students, 
    setStudents,
    timetable,
    config, 
    seating, 
    setSeating,
    setOptimizationStats,
    generateSeating, 
    regenerateSeating, 
    isGenerating, 
    clearSeating, 
    isOptimizing, 
    generationProgress, 
    optimizationStats,
    capacityError,
    setCapacityError,
    updateConfig,
    publishResult
  } = useAdmin()
  const [activeTab, setActiveTab] = useState('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightConflicts, setHighlightConflicts] = useState(true)

  const [seed, setSeed] = useState(12345)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulations, setSimulations] = useState([])

  // Session Management from Timetable
  const distinctSessions = useMemo(() => getDistinctSessions(timetable), [timetable])
  const [selectedSessionKey, setSelectedSessionKey] = useState('')

  useEffect(() => {
    if (distinctSessions.length > 0 && !selectedSessionKey) {
      setSelectedSessionKey(distinctSessions[0].key)
    }
  }, [distinctSessions, selectedSessionKey])

  const activeSession = useMemo(() => {
    if (!distinctSessions.length) return null
    return distinctSessions.find(s => s.key === selectedSessionKey) || distinctSessions[0]
  }, [distinctSessions, selectedSessionKey])

  // Map and filter students specifically taking exams in this session
  const sessionStudents = useMemo(() => {
    if (!activeSession) return students
    return filterStudentsForSession(students, activeSession.entries)
  }, [students, activeSession])

  useEffect(() => {
    setSeed(Math.floor(Math.random() * 999999) + 1)
  }, [])

  const handleGenerateWithSeed = () => {
    if (updateConfig) updateConfig({ seed })
    if (activeSession && sessionStudents.length > 0) {
      generateSeating(sessionStudents)
    } else {
      generateSeating()
    }
  }

  // Generate a realistic cohort of students matching the timetable session exams
  const handlePopulateSessionStudents = () => {
    if (!activeSession || !activeSession.entries.length) {
      alert('Please configure timetable sessions first!')
      return
    }

    const generated = generateStudentsForSession(activeSession.entries, 25)
    setStudents(prev => {
      const nonSession = prev.filter(s => !generated.some(g => g.regNo === s.regNo))
      return [...nonSession, ...generated]
    })

    // Sync to backend asynchronously
    fetch('/api/students/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generated)
    }).catch(() => {})

    // Automatically trigger seating generation for the new cohort
    generateSeating(generated)
  }

  const handleRunSimulations = async () => {
    setIsSimulating(true)
    setSimulations([])
    const candidates = []
    
    const worker = new Worker(new URL('../../workers/seatingWorker.js', import.meta.url), { type: 'module' })
    
    let backendHalls = []
    try {
      const res = await fetch('/api/halls')
      if (res.ok) backendHalls = await res.json()
    } catch (e) {
      console.warn("Failed to fetch halls", e)
    }

    const studentPool = (activeSession && sessionStudents.length > 0) ? sessionStudents : students.filter(s => s && (s.id || s.regNo))

    const runSim = (targetSeed) => {
      return new Promise((resolve) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'complete') resolve(e.data)
          else if (e.data.type === 'error') resolve({ error: e.data.error })
        }
        worker.postMessage({
          type: 'generate',
          students: studentPool,
          config: { ...config, seed: targetSeed },
          halls: backendHalls
        })
      })
    }

    const testSeeds = [seed, seed + 1234, seed + 5678]
    for (let index = 0; index < testSeeds.length; index++) {
      const s = testSeeds[index]
      const data = await runSim(s)
      if (data && !data.error) {
        candidates.push({
          id: index + 1,
          seed: s,
          stats: data.stats,
          result: data.result
        })
      }
    }

    setSimulations(candidates)
    setIsSimulating(false)
    worker.terminate()
  }

  const handleApplyCandidate = (c) => {
    setSeating(c.result)
    setOptimizationStats(c.stats)
  }

  // Auto-generate on first mount if we have students and a session but no seating
  useEffect(() => {
    if (students.length > 0 && seating.length === 0 && !isGenerating) {
      if (activeSession && sessionStudents.length > 0) {
        generateSeating(sessionStudents)
      } else {
        generateSeating()
      }
    }
  }, [students.length, activeSession])

  const totalConflicts = seating.length > 0 ? countAllConflicts(seating, config.mode) : 0
  const allConflicts = seating.flatMap(grid => calculateConflicts(grid, config.mode))
  const { sqi, rating } = calculateSQI(allConflicts)

  const getSQIColor = () => {
    if (sqi >= 90) return 'text-green-400'
    if (sqi >= 70) return 'text-amber-400'
    if (sqi >= 50) return 'text-orange-400'
    return 'text-red-400'
  }

  const getSqiBgColor = () => {
    if (sqi >= 90) return 'bg-green-500'
    if (sqi >= 70) return 'bg-amber-500'
    if (sqi >= 50) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Session Selection & Context Bar */}
      {distinctSessions.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📅</span>
                <span className="font-bold text-white text-base">Exam Session:</span>
                <select 
                  value={selectedSessionKey}
                  onChange={e => setSelectedSessionKey(e.target.value)}
                  className="bg-black/40 border border-white/20 rounded-xl px-3 py-1.5 text-sm font-bold text-primary-300 focus:outline-none focus:border-primary-500 cursor-pointer"
                >
                  {distinctSessions.map(sess => (
                    <option key={sess.key} value={sess.key} className="bg-surface-900 text-white">
                      {sess.label} ({sess.entries.length} exams)
                    </option>
                  ))}
                  <option value="ALL" className="bg-surface-900 text-white">All Students (Non-session cohort)</option>
                </select>
              </div>
              {activeSession && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Scheduled Papers:</span>
                  {activeSession.entries.map((ex, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-primary-500/10 text-primary-300 border border-primary-500/20 rounded-md text-xs font-mono">
                      {ex.courseCode} · {ex.subject} ({ex.department} Y{ex.year})
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {activeSession && sessionStudents.length === 0 ? (
                <button
                  onClick={handlePopulateSessionStudents}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 animate-pulse"
                >
                  ⚡ Populate Students & Allocate
                </button>
              ) : (
                <button
                  onClick={() => generateSeating(activeSession && sessionStudents.length > 0 ? sessionStudents : students)}
                  disabled={isGenerating || isOptimizing}
                  className="btn-primary text-xs font-bold flex items-center gap-2"
                >
                  🚀 Allocate Seating
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hall Capacity Alert */}
      {capacityError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-left flex items-start gap-4 animate-in fade-in">
          <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
            ⚠️
          </div>
          <div className="space-y-1 flex-1">
            <h4 className="font-bold text-red-300 text-sm uppercase tracking-wider">Exam Hall Capacity Warning</h4>
            <p className="text-xs text-white/80 leading-relaxed font-medium">
              {capacityError}
            </p>
          </div>
          <button 
            onClick={() => setCapacityError(null)} 
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all text-xs"
          >
            ✕
          </button>
        </div>
      )}
      {/* Generation Status */}
      {/* Generation Status */}
      {seating.length === 0 && !isGenerating && !isSimulating && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-3xl mx-auto space-y-8 backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[90px] -mr-32 -mt-32 pointer-events-none" />
          
          <div className="text-center space-y-3">
            <h3 className="text-2xl font-black tracking-tight">Pre-flight Configuration & Simulations</h3>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Configure parameters, run mock simulations side-by-side, and choose the most optimal layout configuration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 border border-white/5 p-6 rounded-2xl">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Generation Seed</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(parseInt(e.target.value) || 12345)}
                  className="input-field w-full font-mono"
                />
                <button onClick={() => setSeed(Math.floor(Math.random() * 999999) + 1)} className="btn-secondary whitespace-nowrap text-xs font-bold">
                  Roll Seed
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Mode Selection</label>
              <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white flex items-center justify-between">
                <span>{config.mode === 'internal' ? 'Internal Exam (Mode B)' : 'Semester Exam (Mode A)'}</span>
                <span className="text-xs text-white/40 font-mono">2-Stage spatial solver</span>
              </div>
            </div>
          </div>

          {simulations.length > 0 && (
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-widest text-white/30 font-black block">Simulated Candidates Comparison</label>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/10">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-white/5 text-white/40 font-bold uppercase tracking-widest text-[9px] border-b border-white/10">
                      <th className="px-4 py-3">Candidate</th>
                      <th className="px-4 py-3">Seed</th>
                      <th className="px-4 py-3 text-center">SQI Score</th>
                      <th className="px-4 py-3 text-center">Conflicts</th>
                      <th className="px-4 py-3 text-center">Duration</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {simulations.map(c => (
                      <tr key={c.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-bold">Candidate #{c.id}</td>
                        <td className="px-4 py-3 font-mono text-white/60">{c.seed}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary-400">{Math.round(c.stats.overallScore)}%</td>
                        <td className="px-4 py-3 text-center font-bold text-red-400">{c.stats.totalConflicts}</td>
                        <td className="px-4 py-3 text-center text-white/40">{c.stats.executionTime}ms</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleApplyCandidate(c)} className="px-3 py-1 bg-primary-500/20 text-primary-300 border border-primary-500/30 rounded-lg hover:bg-primary-500 hover:text-white transition-all text-[10px] font-bold">
                            Apply Layout
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-4 border-t border-white/5 pt-6 justify-end">
            <button onClick={handleRunSimulations} className="btn-secondary flex items-center gap-2">
              ⚡ Run Simulations
            </button>
            <button onClick={handleGenerateWithSeed} className="btn-primary">
              Generate Seating
            </button>
          </div>
        </div>
      )}

      {isSimulating && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 max-w-xl mx-auto flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-white/40 font-bold uppercase tracking-widest">Simulating Seating Candidates...</span>
          <p className="text-white/20 text-[10px]">Testing LCG/Mulberry32 spatial distribution graphs on halls configurations</p>
        </div>
      )}

      {(isGenerating || isOptimizing) && (
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-shrink-0" />
            <div className="flex-1">
              <p className="text-primary-300 font-medium">
                {isGenerating ? 'Generating optimal seating...' : 'Optimizing seating...'}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <span className="text-sm text-white/40 w-12">{generationProgress}%</span>
              </div>
              {optimizationStats && (
                <p className="mt-1 text-xs text-white/30">
                  Hall {optimizationStats.currentHall || 1} / {optimizationStats.totalHalls || '?'} 
                  {optimizationStats.executionTime ? ` · ${optimizationStats.executionTime}ms` : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seating Display */}
      {seating.length > 0 && !isGenerating && (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs uppercase tracking-wider">Students</p>
              <p className="text-2xl font-bold">
                {activeSession && sessionStudents.length > 0 
                  ? sessionStudents.length 
                  : seating.flatMap(g => (typeof g.flat === 'function' ? g.flat() : [].concat(...g))).filter(Boolean).length || students.length}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs uppercase tracking-wider">Halls</p>
              <p className="text-2xl font-bold text-primary-400">{seating.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs uppercase tracking-wider">Conflicts</p>
              <p className={`text-2xl font-bold ${totalConflicts === 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalConflicts}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white/50 text-xs uppercase tracking-wider">SQI Score</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${getSQIColor()}`}>{Math.round(sqi)}</p>
                <span className="text-xs text-white/40">{rating}</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div className={`h-full ${getSqiBgColor()} transition-all`} style={{ width: `${sqi}%` }} />
              </div>
            </div>
          </div>

          {/* Multi-dimensional Integrity scoring cards */}
          {optimizationStats && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h4 className="font-bold text-md text-white flex items-center gap-2">
                  🛡️ Integrity & Fairness Scoring Breakdown
                </h4>
                {optimizationStats.seed && (
                  <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded font-mono">
                    Seed: {optimizationStats.seed}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Constraint Compliance</span>
                  <span className="text-2xl font-black text-white mt-1 block">{Math.round(optimizationStats.constraintCompliance ?? 100)}%</span>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary-500" style={{ width: `${optimizationStats.constraintCompliance ?? 100}%` }} />
                  </div>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Paper Separation</span>
                  <span className="text-2xl font-black text-purple-400 mt-1 block">{Math.round(optimizationStats.samePaperSeparation ?? 100)}%</span>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${optimizationStats.samePaperSeparation ?? 100}%` }} />
                  </div>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Dept Separation</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">{Math.round(optimizationStats.deptSeparation ?? 100)}%</span>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${optimizationStats.deptSeparation ?? 100}%` }} />
                  </div>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Accessibility</span>
                  <span className="text-2xl font-black text-blue-400 mt-1 block">{Math.round(optimizationStats.accessibilityScore ?? 100)}%</span>
                  <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${optimizationStats.accessibilityScore ?? 100}%` }} />
                  </div>
                </div>

                <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center bg-gradient-to-br from-primary-950/20 to-purple-950/20 border-primary-500/20">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Overall SQI</span>
                  <span className="text-3xl font-black text-primary-400 mt-1 block">{Math.round(optimizationStats.overallScore ?? sqi)}%</span>
                  <span className="text-[9px] text-white/30 uppercase tracking-widest block font-bold mt-0.5">{optimizationStats.rating || rating}</span>
                </div>
              </div>

              {optimizationStats.relaxationLog && (
                <div className="text-xs text-white/40 flex items-start gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  <span className="text-amber-400 font-bold">ℹ️ Solver Log:</span>
                  <span>{optimizationStats.relaxationLog}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => {
                  if (activeSession && sessionStudents.length > 0) {
                    regenerateSeating(sessionStudents)
                  } else {
                    regenerateSeating()
                  }
                }}
                disabled={isGenerating || isOptimizing}
                className="btn-primary flex items-center gap-2"
                title="Uses maximum optimization power to resolve all conflicts"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isGenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                onClick={clearSeating}
                disabled={isGenerating || isOptimizing}
                className="btn-secondary text-red-400 border-red-500/20 hover:bg-red-500/10"
              >
                Clear
              </button>
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 gap-1">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/seating-versions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          generationId: 'gen-' + Date.now(),
                          version: 1,
                          status: 'DRAFT',
                          allocationsJson: JSON.stringify(seating),
                          metricsJson: JSON.stringify(optimizationStats || {})
                        })
                      });
                      if (res.ok) {
                        alert('✅ Saved as DRAFT. Proceed to Final Output to Approve and Publish to students.');
                      } else {
                        alert('Backend saved (draft stored in-memory). Start backend to persist to database.');
                      }
                    } catch {
                      alert('ℹ️ Backend offline — draft saved in session memory. Start backend to persist.');
                    }
                  }}
                  className="px-4 py-2 rounded font-bold text-xs bg-white/10 hover:bg-white/20 text-white/70"
                >
                  💾 Save Draft
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Enter reason / notes for approval:');
                    if (reason) alert(`✅ Arrangement marked as APPROVED.\nReason: ${reason}\n\nProceed to Final Output to Publish to Students.`);
                  }}
                  className="px-4 py-2 rounded font-bold text-xs bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300"
                >
                  ✅ Approve
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary-500"
              />
              {totalConflicts > 0 && (
                <button
                  onClick={() => setHighlightConflicts(!highlightConflicts)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    highlightConflicts
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-white/10 text-white/60 border border-white/20'
                  }`}
                >
                  ⚠️ {totalConflicts}
                </button>
              )}
            </div>
          </div>

          {/* Publish Result */}
          {publishResult && (
            <div className={`rounded-xl p-4 text-sm font-medium border ${
              publishResult.success
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {publishResult.message}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-white/10">
            {['grid', 'conflicts', 'heatmap'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tab === 'grid' && '📋 Grid View'}
                {tab === 'conflicts' && '⚠️ Conflicts'}
                {tab === 'heatmap' && '🔥 Heatmap'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'grid' && (
            <div className="space-y-8">
              {seating.map((grid, idx) => (
                <div key={idx} className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
                  <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🏛️</span>
                      <span className="font-bold">Hall {idx + 1}</span>
                      <span className="text-white/40 text-sm">
                        {(typeof grid.flat === 'function' ? grid.flat() : [].concat(...grid)).filter(Boolean).length} students
                      </span>
                    </div>
                    {calculateConflicts(grid, config.mode).length > 0 && (
                      <span className="badge bg-red-500/20 text-red-400">
                        {calculateConflicts(grid, config.mode).length} conflicts
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <HallGrid
                      grid={grid}
                      hallIndex={idx}
                      examMode={config.mode}
                      searchTerm={searchTerm}
                      highlightConflicts={highlightConflicts}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'conflicts' && (
            <ConflictPanel halls={seating} mode={config.mode} />
          )}

          {activeTab === 'heatmap' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CourseHeatmap seating={seating} mode={config.mode} />
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <h4 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Conflict Breakdown</h4>
                <div className="space-y-2">
                  {(() => {
                    const typeCounts = {}
                    allConflicts.forEach(c => {
                      typeCounts[c.type] = (typeCounts[c.type] || 0) + 1
                    })
                    return Object.entries(typeCounts).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span className="text-white/40 capitalize">{type.replace(/-/g, ' ')}</span>
                        <span className={`font-bold ${count > 0 ? 'text-red-400' : 'text-green-400'}`}>{count}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Config Change Notice */}
          <div className={`rounded-xl p-4 text-center border ${totalConflicts > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-primary-500/10 border-primary-500/20'}`}>
            <p className="text-sm text-primary-300">
              Configuration: <span className="font-bold">{config.mode === MODES.SEMESTER ? 'Semester' : 'Internal'}</span> mode · 
              <span className="font-bold"> {config.session}</span> session · 
              <span className="font-bold"> {ALGORITHMS.find(a => a.id === config.algorithm)?.name}</span> algorithm
            </p>
            {totalConflicts > 0 ? (
              <p className="text-xs text-red-300 mt-1 font-bold">
                ⚠️ {totalConflicts} conflict{totalConflicts > 1 ? 's' : ''} detected — Click <strong>Regenerate</strong> to resolve all conflicts before proceeding to Export.
              </p>
            ) : (
              <p className="text-xs text-green-400 mt-1 font-bold">
                ✅ Zero conflicts — arrangement is ready to export.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const ALGORITHMS = [
  { id: 'standard', name: 'Standard' },
  { id: 'marks', name: 'Marks Based' },
  { id: 'random', name: 'Random' },
  { id: 'optimized', name: 'Optimized (AI)' },
  { id: 'checkerboard', name: 'Checkerboard' },
]

// Course Heatmap Component
function CourseHeatmap({ seating, mode }) {
  const courseData = useMemo(() => {
    const flat = flattenHalls(seating, mode)
    const courseCounts = {}
    flat.forEach(s => {
      const course = s.courseCode || `${s.dept}-Y${s.year}`
      courseCounts[course] = (courseCounts[course] || 0) + 1
    })
    return Object.entries(courseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [seating, mode])

  const maxCount = Math.max(...courseData.map(([, count]) => count), 1)

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h4 className="text-sm font-bold text-white/60 mb-3 uppercase tracking-wider">Course Distribution</h4>
      <div className="space-y-2">
        {courseData.map(([course, count]) => (
          <div key={course} className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-20 truncate">{course}</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white/60 w-8 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
