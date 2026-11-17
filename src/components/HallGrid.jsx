import { useMemo } from 'react'
import { calculateConflicts, getGridConfig, MODES } from '../utils/seatingEngine'

const PALETTE = [
  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-300', ring: 'ring-indigo-500' },
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', ring: 'ring-emerald-500' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', ring: 'ring-amber-500' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', ring: 'ring-rose-500' },
  { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-300', ring: 'ring-violet-500' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-300', ring: 'ring-cyan-500' },
]

const COLOR_CACHE = {}
function getDeptColor(dept) {
  if (!COLOR_CACHE[dept]) {
    COLOR_CACHE[dept] = PALETTE[Object.keys(COLOR_CACHE).length % PALETTE.length]
  }
  return COLOR_CACHE[dept]
}

export default function HallGrid({ grid, hallIndex, examMode, searchTerm, highlightConflicts }) {
  // Validate grid is a 2D array
  const isGridArray = Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])
  const actualRows = isGridArray ? grid.length : 0
  const actualCols = isGridArray && grid[0] ? grid[0].length : 0

  const conflicts = useMemo(() => isGridArray ? calculateConflicts(grid, examMode) : [], [grid, examMode, isGridArray])
  const conflictSeats = useMemo(() => new Set(conflicts.flatMap(c => [`${c.student1.row}-${c.student1.col}`, `${c.student2.row}-${c.student2.col}`])), [conflicts])

  if (!isGridArray || actualRows === 0) return null

  const seatedCount = isGridArray ? (typeof grid.flat === 'function' ? grid.flat() : [].concat(...grid)).filter(Boolean).length : 0

  return (
    <div className="glass-card p-6 border-white/5 animate-in">
      {/* Hall Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center font-black text-white text-lg shadow-glow">
            {hallIndex + 1}
          </div>
          <div>
            <h3 className="text-lg font-bold">Hall {hallIndex + 1}</h3>
            <p className="text-xs text-white/30 uppercase tracking-widest font-semibold">
              {seatedCount} Students · {actualRows}×{actualCols} layout
            </p>
          </div>
        </div>
        {conflicts.length > 0 && highlightConflicts && (
          <div className="badge bg-red-500/20 text-red-400 border-red-500/30 px-3 py-1 animate-pulse">
            {conflicts.length} Conflicts
          </div>
        )}
      </div>

      {/* Grid — scrollable for large halls */}
      <div className="overflow-x-auto">
        <div className="space-y-2 min-w-max">
          {Array.from({ length: actualRows }, (_, r) => (
            <div key={r} className="flex gap-2">
              <div className="w-6 flex items-center justify-center text-[10px] font-mono text-white/20">R{r+1}</div>
              
              <div className={`flex-1 grid gap-2`} style={{ gridTemplateColumns: `repeat(${actualCols}, 1fr)` }}>
                {Array.from({ length: actualCols }, (_, c) => {
                  const student = grid[r] ? grid[r][c] : null
                  const isConflict = highlightConflicts && conflictSeats.has(`${r + 1}-${c + 1}`)
                  const isMatch = searchTerm && student && (
                    (student.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (student.regNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (student.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  const color = student ? getDeptColor(student.dept) : null
                  
                  // Bench Pairing Logic for visual spacing
                  const isInternal = examMode === MODES.INTERNAL
                  const isBenchStart = isInternal && c % 2 === 0
                  const isBenchEnd = isInternal && c % 2 !== 0

                  return (
                    <div
                      key={c}
                      style={{ minWidth: isInternal ? '80px' : '90px' }}
                      className={`relative rounded-xl border transition-all duration-300 flex flex-col items-center justify-center py-2 px-1 group cursor-default
                        ${isInternal ? (isBenchStart ? 'rounded-r-none border-r-0' : 'rounded-l-none') : ''}
                        ${isInternal && isBenchEnd && c < actualCols - 1 ? 'mr-6' : ''}
                        ${student 
                          ? `${color.bg} ${color.border} ${isConflict ? 'ring-2 ring-red-500 border-red-600 scale-[1.02] z-10' : ''} ${isMatch ? 'ring-4 ring-yellow-400 border-yellow-500 scale-105 z-20 shadow-lg' : ''}` 
                          : 'bg-white/[0.02] border-white/5 opacity-40'
                        }
                      `}
                    >
                      {student ? (
                         <>
                          <div className="flex flex-col items-center -space-y-0.5">
                            <span className={`text-[8px] font-black uppercase opacity-40 ${color.text}`}>Seat {student.seat}</span>
                            <span className={`text-[11px] font-bold truncate max-w-[70px] text-center ${color.text}`}>{(student.name || '').split(' ')[0]}</span>
                            <span className="text-[9px] font-mono opacity-40 tracking-tighter">{student.dept}</span>
                            {student.courseCode && (
                              <span className="text-[8px] font-mono opacity-60 tracking-tighter text-white/40">{student.courseCode}</span>
                            )}
                          </div>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                             <div className="bg-surface-800 border border-white/20 rounded-xl px-4 py-3 text-xs shadow-2xl whitespace-nowrap">
                                <p className="font-black text-white">{student.name}</p>
                                <p className="text-white/50">{student.regNo} • {student.dept} • Year {student.year}</p>
                                {student.courseCode && <p className="text-primary-400 font-mono">{student.courseCode}</p>}
                                <p className="text-[10px] text-primary-400 mt-1 font-mono uppercase">Row {student.row} Col {student.col}</p>
                             </div>
                          </div>
                         </>
                      ) : (
                        <span className="text-white/10 font-bold text-xs">∅</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

       {/* Legend */}
       <div className="mt-8 flex flex-wrap gap-2 pt-6 border-t border-white/5">
        {[...new Set(isGridArray ? (typeof grid.flat === 'function' ? grid.flat() : [].concat(...grid)).filter(Boolean).map(s => s?.dept).filter(Boolean) : [])].map(dept => {
          const c = getDeptColor(dept)
          return (
            <div key={dept} className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
              <div className={`w-2 h-2 rounded-full ${c.bg} border ${c.border}`} />
              <span className="text-[10px] font-bold text-white/40">{dept}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
