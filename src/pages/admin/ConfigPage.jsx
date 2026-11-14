import { useState } from 'react'
import { useAdmin } from '../../context/AdminContext'
import { MODES } from '../../utils/seatingEngine'

const ALGORITHMS = [
  {
    id: 'standard',
    name: 'Standard',
    icon: '📋',
    desc: 'Normal arrangement for smaller student batches. Groups students by dept then interleaves using round-robin so no two students of the same dept+year sit adjacent or on the same bench.',
    detail: 'Best for: Small exams, internal assessments with fewer than 60 students.',
    color: 'from-blue-500/10 to-indigo-500/10',
    border: 'border-blue-500/40',
  },
  {
    id: 'marks',
    name: 'Marks Based',
    icon: '📊',
    desc: 'Uses previous exam marks to compare and choose the best seating. High scorers are strategically separated across halls and rows to maximally reduce malpractice risk between top performers.',
    detail: 'You will be prompted to enter subject marks before generation. Students without marks are treated as average.',
    color: 'from-amber-500/10 to-orange-500/10',
    border: 'border-amber-500/40',
    needsMarks: true,
  },
  {
    id: 'random',
    name: 'Random',
    icon: '🎲',
    desc: 'Uses 3+ shuffling passes with hard dept/year constraints. No same dept+year adjacent, no same dept different year adjacent, no diagonal same-dept neighbours, no same bench same subject. Segregates by subject code per department.',
    detail: 'Algorithm-resistant: every regeneration produces a completely different, unpredictable arrangement.',
    color: 'from-purple-500/10 to-violet-500/10',
    border: 'border-purple-500/40',
  },
  {
    id: 'optimized',
    name: 'Optimized (AI)',
    icon: '🧠',
    desc: 'Most powerful method. Combines Standard + Marks-based + Random — plus dept-wise grouping, round-robin course-code interleaving, subject-wise segregation, and iterative conflict-resolution swaps. Approaches zero conflicts.',
    detail: 'Ultimate malpractice prevention: no same exam sits adjacent, diagonal, or nearby. Recommended for all large exams.',
    color: 'from-emerald-500/10 to-teal-500/10',
    border: 'border-emerald-500/40',
    recommended: true,
  },
]

function MarksDialog({ students, onConfirm, onCancel }) {
  const [marks, setMarks] = useState(() => {
    const init = {}
    students.forEach(s => { init[s.regNo || s.id] = s.marks || '' })
    return init
  })

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-900 border border-amber-500/30 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📊</span>
          <h3 className="font-black text-xl text-white">Enter Previous Exam Marks</h3>
        </div>
        <p className="text-white/40 text-sm mb-4">
          Enter marks for each student for the current subject. These are used to separate high-scorers and reduce malpractice risk.
        </p>
        <div className="overflow-y-auto flex-1 border border-white/10 rounded-xl mb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-800">
              <tr>
                <th className="px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest">Reg. No.</th>
                <th className="px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest">Name</th>
                <th className="px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest">Dept / Year</th>
                <th className="px-4 py-3 text-left text-white/30 text-xs uppercase tracking-widest">Marks (0-100)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {students.map(s => (
                <tr key={s.regNo || s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-white/60 font-mono text-xs">{s.regNo || s.id}</td>
                  <td className="px-4 py-2 text-white/80 truncate max-w-[140px]">{s.name}</td>
                  <td className="px-4 py-2 text-white/40 text-xs">{s.dept} Y{s.year}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number" min="0" max="100"
                      value={marks[s.regNo || s.id] || ''}
                      onChange={e => setMarks(prev => ({ ...prev, [s.regNo || s.id]: e.target.value }))}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm w-24 focus:border-amber-500/50 outline-none"
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-xl border border-white/5">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(marks)}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black rounded-xl shadow-lg shadow-amber-500/20"
          >
            Confirm and Apply Marks
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfigPage() {
  const { config, updateConfig, students, timetable, updateStudent } = useAdmin()
  const [showMarksDialog, setShowMarksDialog] = useState(false)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-sm">Students Ready</p>
          <p className="text-2xl font-bold text-white">{students.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-sm">Timetable Entries</p>
          <p className="text-2xl font-bold text-white">{timetable.length}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-white/50 text-sm">Configuration</p>
          <p className="text-lg font-bold text-primary-400">
            {config.mode === MODES.SEMESTER ? 'Semester' : 'Internal'} {config.session}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Exam Mode</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => updateConfig({ mode: MODES.SEMESTER })}
            className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${config.mode === MODES.SEMESTER ? 'bg-primary-500/20 border-primary-500' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
          >
            <span className="text-3xl">🎓</span>
            <div className="text-left">
              <p className="font-bold text-lg">Semester Mode</p>
              <p className="text-sm text-white/40">1 student per bench 28 seats/hall</p>
            </div>
          </button>
          <button
            onClick={() => updateConfig({ mode: MODES.INTERNAL })}
            className={`flex items-center gap-4 p-5 rounded-xl border transition-all ${config.mode === MODES.INTERNAL ? 'bg-purple-500/20 border-purple-500' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
          >
            <span className="text-3xl">🧪</span>
            <div className="text-left">
              <p className="font-bold text-lg">Internal Mode</p>
              <p className="text-sm text-white/40">2 students per bench 64 seats/hall</p>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Session</h3>
        <div className="flex gap-4">
          {['FN', 'AN'].map((session) => (
            <button
              key={session}
              onClick={() => updateConfig({ session })}
              className={`flex-1 max-w-xs p-4 rounded-xl border transition-all ${config.session === session ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'}`}
            >
              <span className="text-2xl mr-3">{session === 'FN' ? '🌅' : '🌆'}</span>
              <span className="font-bold">{session === 'FN' ? 'Forenoon (FN)' : 'Afternoon (AN)'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider">Seating Algorithm</h3>
          <span className="text-xs text-white/30">Select the arrangement strategy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALGORITHMS.map((algo) => (
            <button
              key={algo.id}
              onClick={() => {
                updateConfig({ algorithm: algo.id })
                if (algo.needsMarks && students.length > 0) setShowMarksDialog(true)
              }}
              className={`p-5 rounded-xl border text-left transition-all relative overflow-hidden ${config.algorithm === algo.id ? `bg-gradient-to-br ${algo.color} ${algo.border} ring-1 ${algo.border}` : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              {algo.recommended && (
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-full border border-emerald-500/30">RECOMMENDED</span>
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{algo.icon}</span>
                <span className="font-bold text-lg">{algo.name}</span>
                {config.algorithm === algo.id && <div className="ml-auto mr-16"><div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse" /></div>}
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-2">{algo.desc}</p>
              <p className="text-xs text-white/30 italic">{algo.detail}</p>
            </button>
          ))}
        </div>
      </div>

      {config.algorithm === 'marks' && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">📊</span>
          <div className="flex-1">
            <p className="font-bold text-amber-300 text-sm">Marks-Based Mode Active</p>
            <p className="text-xs text-white/50 mt-1">Students will be sorted by previous exam marks and interleaved across halls to separate high-scorers.</p>
            <button
              onClick={() => students.length > 0 && setShowMarksDialog(true)}
              className="mt-2 px-4 py-1.5 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
            >
              Enter or Update Marks
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h4 className="font-bold mb-4">Current Configuration</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-white/40 block">Mode</span><span className="font-medium">{config.mode === MODES.SEMESTER ? 'Semester' : 'Internal'}</span></div>
          <div><span className="text-white/40 block">Session</span><span className="font-medium">{config.session}</span></div>
          <div><span className="text-white/40 block">Algorithm</span><span className="font-medium">{ALGORITHMS.find(a => a.id === config.algorithm)?.name}</span></div>
          <div><span className="text-white/40 block">Seats/Hall</span><span className="font-medium">{config.mode === MODES.SEMESTER ? '28' : '64'}</span></div>
        </div>
      </div>

      {showMarksDialog && (
        <MarksDialog
          students={students}
          onCancel={() => setShowMarksDialog(false)}
          onConfirm={(marksMap) => {
            Object.entries(marksMap).forEach(([regNo, mark]) => {
              const val = parseFloat(mark)
              if (!isNaN(val)) updateStudent(regNo, { marks: val })
            })
            setShowMarksDialog(false)
          }}
        />
      )}
    </div>
  )
}
