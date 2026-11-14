import { useState, useMemo, useEffect } from 'react'
import { useAdmin } from '../../context/AdminContext'

export default function ExamTimetablePage() {
  const {
    timetable,
    students,
    addTimetableEntry,
    updateTimetableEntry,
    removeTimetableEntry,
    goToStep,
    nextStep,
    updateConfig
  } = useAdmin()

  // Available unique exam dates extracted from master timetable
  const availableDates = useMemo(() => {
    const dates = new Set()
    timetable.forEach(t => {
      const d = t.examDate || t.date
      if (d) dates.add(d)
    })
    return Array.from(dates).sort()
  }, [timetable])

  // Active Date & Session Selection
  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] || '2026-03-24')
  const [selectedSession, setSelectedSession] = useState('AN')

  // Keep selectedDate valid if availableDates change
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0])
    }
  }, [availableDates, selectedDate])

  // Exams scheduled for selected date & session
  const scheduledExams = useMemo(() => {
    return timetable.filter(t => {
      const d = t.examDate || t.date
      const s = (t.session || 'FN').toUpperCase()
      return d === selectedDate && s === selectedSession
    })
  }, [timetable, selectedDate, selectedSession])

  // Multi-department / paper selection state (array of exam IDs or keys)
  const [selectedExamKeys, setSelectedExamKeys] = useState(() => new Set())

  // Default: select all scheduled exams on date change
  useEffect(() => {
    const keys = new Set(scheduledExams.map((e, idx) => e.id || `${e.department}-${e.year}-${e.courseCode}-${idx}`))
    setSelectedExamKeys(keys)
  }, [scheduledExams])

  const toggleExamSelection = (key) => {
    setSelectedExamKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedExamKeys.size === scheduledExams.length) {
      setSelectedExamKeys(new Set())
    } else {
      const all = new Set(scheduledExams.map((e, idx) => e.id || `${e.department}-${e.year}-${e.courseCode}-${idx}`))
      setSelectedExamKeys(all)
    }
  }

  // Count registered students matching each scheduled paper
  const getEligibleStudentCount = (exam) => {
    const dept = (exam.department || '').toUpperCase().trim()
    const yr = exam.year || 1
    return students.filter(s => {
      const sDept = (s.dept || '').toUpperCase().trim()
      const sYr = s.year || 1
      return sDept.includes(dept) || dept.includes(sDept) && sYr === yr
    }).length
  }

  // Total participating students for selected exams
  const totalParticipatingStudents = useMemo(() => {
    const activeExams = scheduledExams.filter((e, idx) => {
      const k = e.id || `${e.department}-${e.year}-${e.courseCode}-${idx}`
      return selectedExamKeys.has(k)
    })
    let count = 0
    activeExams.forEach(e => {
      count += getEligibleStudentCount(e)
    })
    return count
  }, [scheduledExams, selectedExamKeys, students])

  // Manual Quick Add / Edit Form State
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    department: 'CSE',
    year: 2,
    courseCode: '',
    subject: '',
    examDate: selectedDate,
    session: selectedSession,
    examType: 'University Examination'
  })

  const handleSaveManual = (e) => {
    e.preventDefault()
    addTimetableEntry({
      ...manualForm,
      examDate: selectedDate,
      session: selectedSession
    })
    setShowManualModal(false)
    setManualForm({
      department: 'CSE',
      year: 2,
      courseCode: '',
      subject: '',
      examDate: selectedDate,
      session: selectedSession,
      examType: 'University Examination'
    })
  }

  // Proceed to Allocation with selected date, session, and papers
  const handleProceedToAllocation = () => {
    const activeExams = scheduledExams.filter((e, idx) => {
      const k = e.id || `${e.department}-${e.year}-${e.courseCode}-${idx}`
      return selectedExamKeys.has(k)
    })

    if (activeExams.length === 0) {
      alert('Please select at least one department / exam paper to proceed.')
      return
    }

    // Enrich participating students with their specific courseCode and subject details
    const activeStudentList = []
    const seenReg = new Set()

    activeExams.forEach(exam => {
      const dept = (exam.department || '').toUpperCase().trim()
      const yr = exam.year || 1

      const matching = students.filter(s => {
        const sDept = (s.dept || '').toUpperCase().trim()
        const sYr = s.year || 1
        return (sDept.includes(dept) || dept.includes(sDept)) && sYr === yr
      })

      matching.forEach(s => {
        if (!seenReg.has(s.regNo)) {
          seenReg.add(s.regNo)
          activeStudentList.push({
            ...s,
            courseCode: exam.courseCode,
            subject: exam.subject,
            examDate: selectedDate,
            session: selectedSession,
            examType: exam.examType || 'University Examination'
          })
        }
      })
    })

    if (updateConfig) {
      updateConfig({ session: selectedSession, examDate: selectedDate })
    }

    // Navigate to Allocation step
    goToStep(4)
  }

  return (
    <div className="space-y-6 text-white animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>📅</span> Exam Session Selection
          </h2>
          <p className="text-sm text-white/50 mt-1">
            Pick an exam date from the master schedule to review scheduled papers, participating departments, and semester levels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setManualForm(prev => ({ ...prev, examDate: selectedDate, session: selectedSession }))
              setShowManualModal(true)
            }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <span>➕</span> Add Schedule Paper
          </button>
        </div>
      </div>

      {/* Date Picker Bar & Session Toggle */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6 backdrop-blur-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Calendar Date Picker */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">
              1. Select Examination Date
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-black/30 border border-white/20 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-primary-500"
              />
              {/* Quick Date Chips from Timetable */}
              <div className="flex items-center gap-2 flex-wrap">
                {availableDates.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                      selectedDate === d
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-white/60'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Session Selector (FN / AN) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">
              2. Session (Slot)
            </label>
            <div className="flex rounded-xl bg-black/30 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setSelectedSession('FN')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  selectedSession === 'FN'
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                ☀️ Forenoon (FN)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSession('AN')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  selectedSession === 'AN'
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                🌙 Afternoon (AN)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Available Exams Matrix */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📋</span> Scheduled Papers for {selectedDate} ({selectedSession})
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Select which departments and semester papers to allocate in this session.
            </p>
          </div>
          {scheduledExams.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-primary-400 hover:text-primary-300 font-semibold"
              >
                {selectedExamKeys.size === scheduledExams.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="badge bg-primary-500/20 text-primary-300 font-mono text-xs">
                {selectedExamKeys.size} of {scheduledExams.length} Selected
              </span>
            </div>
          )}
        </div>

        {scheduledExams.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-xl space-y-3">
            <span className="text-3xl">🗓️</span>
            <p className="text-white/70 font-semibold text-sm">
              No exams scheduled on {selectedDate} ({selectedSession}) in the master timetable.
            </p>
            <p className="text-xs text-white/40 max-w-md mx-auto">
              You can click <strong>Add Schedule Paper</strong> above to manually define one, or upload your timetable PDF in <strong>Student Database &gt; Subjects</strong>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-white/5 text-white/60 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-4 py-3 w-12 text-center">Select</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3">Semester / Year</th>
                  <th className="px-4 py-3">Course Code</th>
                  <th className="px-4 py-3">Subject Title</th>
                  <th className="px-4 py-3">Exam Type</th>
                  <th className="px-4 py-3 text-right">Students Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scheduledExams.map((exam, idx) => {
                  const key = exam.id || `${exam.department}-${exam.year}-${exam.courseCode}-${idx}`
                  const isSelected = selectedExamKeys.has(key)
                  const studentCount = getEligibleStudentCount(exam)

                  return (
                    <tr
                      key={key}
                      onClick={() => toggleExamSelection(key)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary-500/10 hover:bg-primary-500/15' : 'hover:bg-white/5 opacity-60'
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleExamSelection(key)}
                          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 focus:ring-offset-0 bg-white/10 border-white/30 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-bold text-primary-300">
                        {exam.department}
                      </td>
                      <td className="px-4 py-3 text-white/80">
                        Sem {exam.year * 2 || 1} · Year {exam.year || 1}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-white">
                        {exam.courseCode}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {exam.subject}
                      </td>
                      <td className="px-4 py-3 text-xs text-white/60">
                        {exam.examType || 'University Examination'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                        {studentCount} students
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Proceed Action Card */}
        {scheduledExams.length > 0 && (
          <div className="flex items-center justify-between p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 flex-wrap gap-4 mt-6">
            <div>
              <p className="font-bold text-white text-sm">
                Ready for Seating Allocation: <span className="text-primary-300 font-mono">{totalParticipatingStudents} Students</span>
              </p>
              <p className="text-xs text-white/50">
                Participating departments and student cohorts will be fed into the seating algorithm.
              </p>
            </div>
            <button
              onClick={handleProceedToAllocation}
              disabled={selectedExamKeys.size === 0 || totalParticipatingStudents === 0}
              className="btn-primary py-3 px-8 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-500/30 disabled:opacity-40"
            >
              <span>🪑</span> Proceed to Allocation ({totalParticipatingStudents} Students)
            </button>
          </div>
        )}
      </div>

      {/* Manual Schedule Paper Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-surface-900 border border-white/15 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-lg text-white">Add Paper to {selectedDate} ({selectedSession})</h4>
              <button onClick={() => setShowManualModal(false)} className="text-white/40 hover:text-white text-lg">✕</button>
            </div>
            <form onSubmit={handleSaveManual} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Department</label>
                  <input
                    type="text"
                    value={manualForm.department}
                    onChange={e => setManualForm({ ...manualForm, department: e.target.value.toUpperCase() })}
                    className="input-field w-full uppercase"
                    placeholder="e.g. CSE"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Year (1-4)</label>
                  <input
                    type="number"
                    min="1" max="4"
                    value={manualForm.year}
                    onChange={e => setManualForm({ ...manualForm, year: parseInt(e.target.value) || 1 })}
                    className="input-field w-full"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Course Code</label>
                <input
                  type="text"
                  value={manualForm.courseCode}
                  onChange={e => setManualForm({ ...manualForm, courseCode: e.target.value.toUpperCase() })}
                  className="input-field w-full uppercase font-mono"
                  placeholder="e.g. CS23411"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-white/50 block mb-1">Subject Title</label>
                <input
                  type="text"
                  value={manualForm.subject}
                  onChange={e => setManualForm({ ...manualForm, subject: e.target.value })}
                  className="input-field w-full"
                  placeholder="e.g. Database Management Systems"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                <button type="button" onClick={() => setShowManualModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Save to Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
