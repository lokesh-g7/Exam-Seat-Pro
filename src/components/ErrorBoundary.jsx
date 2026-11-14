import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-8 max-w-xl w-full text-center space-y-4 backdrop-blur-xl shadow-2xl">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto text-3xl">
              ⚠️
            </div>
            <h3 className="text-xl font-black text-white">Something went wrong on this screen</h3>
            <p className="text-xs text-white/50 font-mono bg-black/40 p-4 rounded-xl border border-white/5 break-words text-left">
              {this.state.error?.message || String(this.state.error)}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button 
                onClick={this.handleReset} 
                className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs rounded-xl transition-all shadow-lg"
              >
                🔄 Try Again
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all border border-white/10"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
