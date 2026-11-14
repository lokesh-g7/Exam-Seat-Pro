import { calculateHeatmap } from '../utils/seatingEngine'

const HEAT_COLORS = [
  'bg-blue-500/80',
  'bg-emerald-500/80',
  'bg-amber-500/80',
  'bg-rose-500/80',
  'bg-violet-500/80',
  'bg-cyan-500/80',
]

export default function Heatmap({ halls, mode }) {
  if (!halls || halls.length === 0) return null

  const allDepts = new Set()
  const hallHeatmaps = halls.map((grid) => {
    const hm = calculateHeatmap(grid)
    Object.keys(hm).forEach(d => allDepts.add(d))
    return hm
  })
  const deptList = [...allDepts].sort()

  return (
    <div className="glass-card p-8 border-white/5 animate-in space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold">Department Heatmap</h3>
            <p className="text-sm text-white/40 uppercase tracking-widest font-black">Subject Distribution Analysis</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest opacity-30">Department</th>
              {hallHeatmaps.map((_, i) => (
                <th key={i} className="p-4 text-[10px] font-black uppercase tracking-widest opacity-30 text-center">Hall {i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deptList.map((dept, deptIdx) => (
              <tr key={dept} className="border-t border-white/5 hover:bg-white/[0.02] transition-all">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${HEAT_COLORS[deptIdx % HEAT_COLORS.length]}`} />
                    <span className="font-bold text-sm">{dept}</span>
                  </div>
                </td>
                {hallHeatmaps.map((hm, i) => {
                  const data = hm[dept]
                  const pct = data ? parseFloat(data.percentage) : 0
                  return (
                    <td key={i} className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono opacity-40">
                           <span>{data ? data.count : 0} Students</span>
                           <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${HEAT_COLORS[deptIdx % HEAT_COLORS.length]}`} 
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
