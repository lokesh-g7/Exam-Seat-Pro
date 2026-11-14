import { useState, useEffect } from 'react'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return dateStr }
}

function isUpcoming(dateStr) {
  if (!dateStr) return false
  try {
    return new Date(dateStr) >= new Date(new Date().toDateString())
  } catch { return false }
}

export default function StudentDashboard({ user, onLogout }) {
  const [allocation, setAllocation] = useState(null)
  const [timetable, setTimetable] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  // Issue Reporting Modal States
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [issueCategory, setIssueCategory] = useState('Seat Allocation')
  const [issueMessage, setIssueMessage] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)
  const [issueSuccess, setIssueSuccess] = useState(null)
  const [issueError, setIssueError] = useState(null)

  // Use regNo from user record (set during sign up or stored in JWT)
  const regNo = (user.regNo || user.username || user.id || '').trim()
  const dept = (user.dept || '').trim()
  const year = user.year || user.examYear || 1

  useEffect(() => {
    let cancelled = false

    async function fetchData() {
      setIsLoading(true)
      setError(null)
      try {
        // 1. Fetch seat allocation by regNo
        const allocRes = await fetch(`/api/allocations/${encodeURIComponent(regNo)}`)
        if (!cancelled) {
          if (allocRes.ok) {
            setAllocation(await allocRes.json())
          } else if (allocRes.status !== 404) {
            throw new Error('Failed to fetch allocation')
          }
        }

        // 2. Fetch timetable for student's dept + year
        if (dept && year) {
          const ttRes = await fetch(`/api/timetable/student/${encodeURIComponent(dept)}/${year}`)
          if (!cancelled && ttRes.ok) {
            setTimetable(await ttRes.json())
          }
        }
      } catch (err) {
        if (!cancelled) setError('Connection failed. Please check if the server is running.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [regNo, dept, year, retryCount])

  // Find next upcoming exam
  const nextExam = timetable.find(t => isUpcoming(t.examDate))
  const upcomingExams = timetable.filter(t => isUpcoming(t.examDate))
  const pastExams = timetable.filter(t => !isUpcoming(t.examDate))

  async function handleIssueSubmit(e) {
    e.preventDefault()
    if (!issueMessage.trim()) return
    setIsSubmittingIssue(true)
    setIssueError(null)
    setIssueSuccess(null)
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regNo,
          studentName: user.name || regNo,
          dept,
          year,
          category: issueCategory,
          message: issueMessage.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit issue')
      }
      setIssueSuccess('Your issue has been reported. Exam administration has been notified.')
      setIssueMessage('')
      setTimeout(() => {
        setShowIssueModal(false)
        setIssueSuccess(null)
      }, 2500)
    } catch (err) {
      setIssueError(err.message)
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 text-slate-800 flex flex-col">
      {/* Header */}
      <header className="border-b border-orange-200/60 bg-white/70 backdrop-blur-md p-4 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-300/40">
              EP
            </div>
            <div>
              <h1 className="font-bold text-slate-800">ExamSeat Pro</h1>
              <p className="text-xs text-slate-500">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Report an Issue Button (Positioned left of the Student Name) */}
            <button
              onClick={() => {
                setShowIssueModal(true)
                setIssueError(null)
                setIssueSuccess(null)
              }}
              className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 hover:bg-amber-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Report an issue or struggle with exam hall/seating"
            >
              <span>⚠️</span>
              <span>Report an Issue</span>
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-700">{user.name || regNo}</p>
              <p className="text-xs text-slate-400">{dept} · Year {year}</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Loading your dashboard...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-bold">{error}</p>
            <button onClick={() => setRetryCount(c => c + 1)} className="mt-4 px-5 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 transition-colors">
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-xl shadow-orange-300/30">
              <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mb-1">Welcome back</p>
              <h2 className="text-2xl font-black">{user.name || 'Student'}</h2>
              <p className="text-orange-100 text-sm mt-1">{regNo} · {dept} · Year {year}</p>
            </div>

            {/* Seat Allocation Card */}
            <div className="bg-white rounded-2xl border border-orange-200/60 shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🪑</span>
                  <h3 className="font-black text-slate-700">Your Seat Allocation</h3>
                </div>
              </div>
              {allocation ? (
                <div className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Exam Hall', value: allocation.hallName || `Hall ${allocation.hall}`, highlight: true },
                      { label: 'Seat No.', value: allocation.seat, highlight: true },
                      { label: 'Row', value: allocation.seatRow ?? allocation.row ?? '—' },
                      { label: 'Column', value: allocation.seatCol ?? allocation.col ?? '—' },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className={`rounded-xl p-4 text-center ${highlight ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-300/30' : 'bg-orange-50 border border-orange-100'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${highlight ? 'text-orange-100' : 'text-slate-400'}`}>{label}</p>
                        <p className={`text-2xl font-black mt-1 ${highlight ? 'text-white' : 'text-slate-700'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {(allocation.courseCode || allocation.examDate || allocation.session) && (
                    <div className="mt-4 p-3 bg-orange-50 rounded-xl border border-orange-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {allocation.courseCode && (
                        <span className="font-bold text-slate-700">
                          📖 {allocation.courseCode} {allocation.subject ? `— ${allocation.subject}` : ''}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-slate-500 ml-auto font-medium">
                        {allocation.examDate && <span>📅 {allocation.examDate}</span>}
                        {allocation.session && (
                          <span className="px-2 py-0.5 rounded-full bg-orange-200/60 text-orange-800 font-bold text-[10px]">
                            {allocation.session}
                          </span>
                        )}
                        {allocation.examMode && <span className="uppercase text-[10px]">({allocation.examMode})</span>}
                      </div>
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-orange-100 text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Official Seating Slip · ExamSeat Pro</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-14 h-14 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <p className="font-bold text-slate-600">Seat not yet allocated</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Your seat will appear here once the admin publishes the seating arrangement.
                  </p>
                </div>
              )}
            </div>

            {/* Next Exam Card */}
            {nextExam && (
              <div className="bg-white rounded-2xl border border-blue-200/60 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📅</span>
                    <h3 className="font-black text-slate-700">Your Next Exam</h3>
                    <span className="ml-auto px-2 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full">Upcoming</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shadow-blue-300/30 p-2">
                        <span className="text-[10px] font-black uppercase tracking-tight">
                          {new Date(nextExam.examDate).toLocaleString('en', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className="text-3xl font-black leading-none">
                          {new Date(nextExam.examDate).getDate()}
                        </span>
                        <span className="text-[10px] font-bold opacity-70">
                          {new Date(nextExam.examDate).getFullYear()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{nextExam.courseCode}</p>
                      <h4 className="text-xl font-black text-slate-800 mt-1">{nextExam.subject}</h4>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${nextExam.session === 'FN' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                          {nextExam.session === 'FN' ? '🌅 Forenoon' : '🌆 Afternoon'}
                        </span>
                        <span className="text-sm text-slate-500">{formatDate(nextExam.examDate)}</span>
                      </div>
                    </div>
                    {allocation && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center min-w-[120px]">
                        <p className="text-xs text-blue-500 font-bold uppercase">Your Seat</p>
                        <p className="text-lg font-black text-blue-700 mt-1">Hall {allocation.hall}</p>
                        <p className="text-sm text-blue-600 font-bold">Seat {allocation.seat}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Exams count */}
            {upcomingExams.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-green-200/60 p-3 text-center">
                  <p className="text-2xl font-black text-green-600">{upcomingExams.length}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Upcoming</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/60 p-3 text-center">
                  <p className="text-2xl font-black text-slate-400">{pastExams.length}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Completed</p>
                </div>
                <div className="bg-white rounded-xl border border-orange-200/60 p-3 text-center">
                  <p className="text-2xl font-black text-orange-500">{timetable.length}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Total</p>
                </div>
              </div>
            )}

            {/* Full Timetable */}
            {timetable.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🗓️</span>
                    <h3 className="font-black text-slate-700">Full Exam Schedule</h3>
                    <span className="text-xs text-slate-400 ml-2">{dept} · Year {year}</span>
                    <span className="ml-auto text-xs text-slate-400">{timetable.length} exams</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {timetable.map((exam) => {
                    const upcoming = isUpcoming(exam.examDate)
                    const isNext = nextExam && exam.courseCode === nextExam.courseCode && exam.examDate === nextExam.examDate
                    return (
                      <div
                        key={exam.id || `${exam.courseCode}-${exam.examDate}`}
                        className={`px-6 py-4 flex items-center gap-4 transition-colors ${upcoming ? 'hover:bg-orange-50/50' : 'opacity-60'} ${isNext ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-white text-xs font-black ${upcoming ? 'bg-gradient-to-br from-orange-400 to-amber-500' : 'bg-slate-300'}`}>
                          <span className="text-[8px] leading-none">
                            {new Date(exam.examDate).toLocaleString('en', { month: 'short' }).toUpperCase()}
                          </span>
                          <span className="text-base leading-none">
                            {new Date(exam.examDate).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{exam.courseCode}</span>
                            <span className="font-bold text-slate-700 truncate">{exam.subject}</span>
                            {isNext && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-wide">Next</span>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(exam.examDate)}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 ${exam.session === 'FN' ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>
                          {exam.session}
                        </span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${upcoming ? 'bg-green-400' : 'bg-slate-300'}`} title={upcoming ? 'Upcoming' : 'Completed'} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {timetable.length === 0 && !isLoading && (
              <div className="bg-white rounded-2xl border border-dashed border-orange-200 p-8 text-center">
                <span className="text-4xl block mb-3">📋</span>
                <p className="font-bold text-slate-500">No timetable available for your department yet.</p>
                <p className="text-sm text-slate-400 mt-1">Check back after the admin uploads the exam schedule.</p>
              </div>
            )}

            <p className="text-center text-xs text-slate-400 pb-4">
              ExamSeat Pro · Student Portal · Reg: {regNo}
            </p>
          </>
        )}
      </main>

      {/* ─── Issue Reporting Modal ─── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-orange-100 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
                  ⚠️
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">Report an Issue</h3>
                  <p className="text-xs text-slate-500">Submit your seating or hall struggle to the admin</p>
                </div>
              </div>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {issueSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
                <span>✅</span>
                <span>{issueSuccess}</span>
              </div>
            )}

            {issueError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                <span>⚠️</span>
                <span>{issueError}</span>
              </div>
            )}

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Issue Category
                </label>
                <select
                  value={issueCategory}
                  onChange={e => setIssueCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="Seat Allocation">Seat Allocation / Seat Not Found</option>
                  <option value="Hall Finding">Exam Hall Finding / Building Direction</option>
                  <option value="Timetable Conflict">Timetable / Subject Code Conflict</option>
                  <option value="Accessibility">Accessibility / Physical Desk Need</option>
                  <option value="General">General Seating Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Describe the Issue
                </label>
                <textarea
                  value={issueMessage}
                  onChange={e => setIssueMessage(e.target.value)}
                  placeholder="Describe your issue in detail (e.g., Cannot locate assigned Hall B, or my seat 14 desk is damaged)..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:border-amber-500 resize-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 space-y-1">
                <p><strong>Submitting as:</strong> {user.name || regNo} ({regNo})</p>
                <p><strong>Department & Year:</strong> {dept || 'General'} · Year {year}</p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue || !issueMessage.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingIssue ? 'Submitting...' : 'Submit Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
