import { useState, useEffect } from 'react'
import { useAdmin } from '../../context/AdminContext'

const STEPS = [
  { id: 0, label: 'Dashboard Overview', icon: '📊' },
  { id: 1, label: 'Student Database', icon: '👥' },
  { id: 2, label: 'Exam Timetable', icon: '📅' },
  { id: 3, label: 'Configuration', icon: '⚙️' },
  { id: 4, label: 'Allocation', icon: '🪑' },
  { id: 5, label: 'Final Output', icon: '📤' },
  { id: 6, label: 'Audit Logs', icon: '🛡️' },
]

export default function AdminLayout({ children, onLogout }) {
  const { currentStep, goToStep, nextStep, prevStep, canProceed, students, timetable, seating } = useAdmin()
  
  const [showFloatingNav, setShowFloatingNav] = useState(false)
  const [isNearBottom, setIsNearBottom] = useState(false)
  const [openIssuesCount, setOpenIssuesCount] = useState(0)

  useEffect(() => {
    fetch('/api/issues/summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.openCount != null) {
          setOpenIssuesCount(data.openCount)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const docHeight = document.documentElement.scrollHeight
      const winHeight = window.innerHeight
      
      setShowFloatingNav(scrollY > 100)
      setIsNearBottom(scrollY + winHeight > docHeight - 200)
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const getStepStatus = (stepId) => {
    if (stepId === currentStep) return 'active'
    if (stepId < currentStep) return 'completed'
    return 'pending'
  }

  const isStepClickable = (stepId) => {
    if (stepId < currentStep) return true
    if (stepId === currentStep + 1) return canProceed()
    return stepId === currentStep
  }

  const getStepIndicator = (stepId) => {
    const status = getStepStatus(stepId)
    if (status === 'completed') {
      return <span className="text-green-400">✓</span>
    }
    if (status === 'active') {
      return <div className="w-2 h-2 bg-primary-400 rounded-full" />
    }
    return <div className="w-2 h-2 bg-white/20 rounded-full" />
  }

  return (
    <div className="min-h-screen bg-surface-950 text-white flex">
      <aside className="fixed left-0 top-0 h-screen w-[250px] bg-surface-900 border-r border-white/10 flex flex-col z-50">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center font-bold text-white">
              EP
            </div>
            <div>
              <h1 className="font-bold text-lg">ExamSeat Pro</h1>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {STEPS.map((step) => {
            const status = getStepStatus(step.id)
            const clickable = isStepClickable(step.id)
            
            return (
              <button
                key={step.id}
                onClick={() => clickable && goToStep(step.id)}
                disabled={!clickable}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  status === 'active'
                    ? 'bg-primary-500/20 border border-primary-500/50 text-white'
                    : status === 'completed'
                    ? 'bg-white/5 text-white/70 hover:bg-white/10'
                    : 'text-white/30 cursor-not-allowed'
                }`}
              >
                <span className="text-lg">{step.icon}</span>
                <span className="font-medium text-sm flex-1">{step.label}</span>
                {step.id === 6 && openIssuesCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black font-mono animate-pulse mr-2" title={`${openIssuesCount} student issues open`}>
                    {openIssuesCount}
                  </span>
                )}
                <div className="ml-auto">
                  {getStepIndicator(step.id)}
                </div>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Students</span>
            <span className="font-bold text-white">{students.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/40">Timetable</span>
            <span className="font-bold text-white">{timetable.length}</span>
          </div>
          {seating.length > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-white/40">Halls</span>
              <span className="font-bold text-primary-400">{seating.length}</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen ml-[250px]">
        <header className="bg-surface-900/50 border-b border-white/10 px-8 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{STEPS[currentStep]?.label}</h2>
            
            <div className="flex items-center gap-2">
              {STEPS.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.id <= currentStep
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {step.id < currentStep ? '✓' : step.id + 1}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`w-8 h-0.5 ${
                        step.id < currentStep ? 'bg-primary-500' : 'bg-white/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>

        <footer className="bg-surface-900/50 border-t border-white/10 px-8 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                currentStep === 0
                  ? 'text-white/20 cursor-not-allowed'
                  : 'bg-white/5 hover:bg-white/10 text-white'
              }`}
            >
              ← Back
            </button>

            <div className="text-sm text-white/40">
              Step {currentStep + 1} of {STEPS.length}
            </div>

            <button
              onClick={nextStep}
              disabled={!canProceed() || currentStep === 5}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                !canProceed() || currentStep === 5
                  ? 'bg-white/5 text-white/20 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 text-white'
              }`}
            >
              Next →
            </button>
          </div>
        </footer>

        {/* Floating Navigation - appears when scrolled */}
        {showFloatingNav && !isNearBottom && (
          <div className="fixed bottom-6 right-6 flex gap-2 z-50">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`px-4 py-3 rounded-xl font-medium shadow-lg transition-all ${
                currentStep === 0
                  ? 'bg-white/10 text-white/20 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              ← Back
            </button>
            <button
              onClick={nextStep}
              disabled={!canProceed() || currentStep === 5}
              className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all ${
                !canProceed() || currentStep === 5
                  ? 'bg-white/20 text-white/40 cursor-not-allowed'
                  : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/25'
              }`}
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
