import { useMemo } from 'react'
import { calculateConflicts, calculateSQI } from '../utils/seatingEngine'

export default function StatsBar({ halls, students, algorithm, mode }) {
  const stats = useMemo(() => {
    if (!halls || halls.length === 0) return null

    let totalConflicts = 0
    let totalSQI = 0
    const validHalls = halls.filter(g => Array.isArray(g) && Array.isArray(g[0]))

    validHalls.forEach(grid => {
      const conflicts = calculateConflicts(grid, mode)
      const { sqi } = calculateSQI(conflicts)
      totalConflicts += conflicts.length
      totalSQI += sqi
    })

    const avgSQI = validHalls.length > 0 ? Math.round(totalSQI / validHalls.length) : 0
    const totalSeated = validHalls.reduce((sum, grid) => sum + (typeof grid.flat === 'function' ? grid.flat() : [].concat(...grid)).filter(Boolean).length, 0)

    return {
      totalStudents: students.length,
      totalSeated,
      totalHalls: validHalls.length,
      totalConflicts,
      avgSQI,
    }
  }, [halls, students, mode])

  if (!stats) return null

  const items = [
    { label: 'Seated', value: stats.totalSeated, sub: `of ${stats.totalStudents}`, color: 'text-blue-400', icon: '👤' },
    { label: 'Halls', value: stats.totalHalls, color: 'text-purple-400', icon: '🏛' },
    { label: 'Conflicts', value: stats.totalConflicts, color: stats.totalConflicts === 0 ? 'text-emerald-400' : 'text-red-400', icon: '⚠' },
    { label: 'SQI Score', value: stats.avgSQI, sub: stats.avgSQI >= 90 ? 'Excellent' : stats.avgSQI >= 70 ? 'Good' : 'Needs Fix', color: stats.avgSQI >= 80 ? 'text-primary-400' : 'text-amber-400', icon: '🎯' },
    { label: 'Algorithm', value: algorithm, isText: true, color: 'text-white/60', icon: '⚙' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in">
      {items.map((item, i) => (
        <div key={i} className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-1 relative overflow-hidden group">
          <div className="flex items-center gap-2 opacity-50">
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </div>
          <div className={`text-2xl font-black font-mono ${item.color} truncate`}>
            {item.value}
          </div>
          {item.sub && <p className="text-[10px] font-medium opacity-30">{item.sub}</p>}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-all duration-500" />
        </div>
      ))}
    </div>
  )
}
