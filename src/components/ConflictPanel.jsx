import { useMemo } from 'react'
import { calculateConflicts, calculateSQI, MODES } from '../utils/seatingEngine'

export default function ConflictPanel({ halls, mode = MODES.SEMESTER }) {
  const hallData = useMemo(() => {
    return halls.map((grid, i) => {
      const conflicts = calculateConflicts(grid, mode)
      const { sqi, rating } = calculateSQI(conflicts)
      return { hallIndex: i, conflicts, sqi, rating }
    })
  }, [halls, mode])

  const totalConflicts = hallData.reduce((sum, h) => sum + h.conflicts.length, 0)
  const avgSQI = hallData.length > 0 ? Math.round(hallData.reduce((sum, h) => sum + h.sqi, 0) / hallData.length) : 100

  return (
    <div className="glass-card p-8 border-white/5 space-y-8 animate-in">
       <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-bold">Conflict Logic Analysis</h3>
            <p className="text-sm text-white/40">Mode: <span className="uppercase font-bold text-primary-400">{mode}</span> • Penalty Tier Applied</p>
          </div>
          <div className="text-right">
             <p className={`text-4xl font-black font-mono ${avgSQI >= 80 ? 'text-primary-400' : 'text-amber-400'}`}>{avgSQI}<span className="text-lg opacity-40">/100</span></p>
             <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Global Seating Index</p>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hallData.map((h, i) => (
             <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                <div>
                   <p className="text-xs font-bold opacity-30 uppercase">Hall {h.hallIndex + 1}</p>
                   <p className={`text-lg font-black ${h.conflicts.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{h.conflicts.length} Issues</p>
                </div>
                <div className="text-right">
                   <p className={`text-lg font-black ${h.sqi >= 80 ? 'text-primary-400' : 'text-amber-400'}`}>{h.sqi}</p>
                   <p className="text-[10px] font-bold opacity-30">{h.rating}</p>
                </div>
             </div>
          ))}
       </div>

       {totalConflicts > 0 && (
         <div className="space-y-4 pt-6 border-t border-white/5">
            <h4 className="text-sm font-black uppercase text-white/20 tracking-tighter">Detailed Conflict Report</h4>
            <div className="grid gap-3">
              {hallData.flatMap(h => h.conflicts.map(c => (
                 <div key={c.key} className="flex items-center gap-4 p-4 bg-red-500/5 border border-red-500/10 rounded-xl group transition-all hover:bg-red-500/10 hover:border-red-500/30">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center font-bold text-red-400">H{h.hallIndex+1}</div>
                    <div className="flex-1">
                       <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{c.student1.name}</span>
                          <span className="text-white/20">↔</span>
                          <span className="font-bold text-white">{c.student2.name}</span>
                       </div>
                       <p className="text-[10px] text-white/30 uppercase tracking-widest font-black mt-1">{c.type.replace(/-/g, ' ')}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-black text-red-500">-{c.score} PTS</span>
                    </div>
                 </div>
              )))}
            </div>
         </div>
       )}
    </div>
  )
}
