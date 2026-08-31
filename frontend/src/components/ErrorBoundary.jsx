import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    // NEVER call window.location.reload() automatically to prevent unexpected page reloads while user is active
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errString = this.state.error ? this.state.error.toString() : '';
      const isChunkError =
        errString.includes('Failed to fetch dynamically imported module') ||
        errString.includes('Importing a module script failed') ||
        errString.includes('ChunkLoadError');

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white font-sans">
          <div className="max-w-xl w-full rounded-3xl border border-cyan-400/30 p-8 space-y-6 bg-slate-900/90 shadow-2xl backdrop-blur-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30 text-white text-2xl font-black">
              ⚡
            </div>

            {isChunkError ? (
              <div className="space-y-3">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  New Application Version Available
                </h2>
                <p className="text-sm text-slate-300 font-medium leading-relaxed">
                  EDOT Platform has just been updated with new features! Please click below to refresh and load the latest bundle when you are ready.
                </p>
                <button
                  onClick={this.handleReload}
                  className="mt-4 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-sm transition-all shadow-xl shadow-cyan-500/25 hover:scale-105 active:scale-95 cursor-pointer"
                >
                  Refresh & Load Latest Version
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-left">
                <h2 className="text-xl font-black text-white text-center">
                  Something went wrong in the Dashboard UI
                </h2>
                <button
                  onClick={this.handleReload}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-black text-sm transition-all shadow-xl shadow-cyan-500/25 cursor-pointer"
                >
                  Reload Application
                </button>
                <details className="mt-4 p-4 rounded-2xl bg-slate-800/80 border border-white/10 text-xs font-mono text-slate-300 overflow-auto max-h-60 custom-scrollbar">
                  <summary className="font-bold text-cyan-400 cursor-pointer mb-2">
                    Click to view error details
                  </summary>
                  {this.state.error && <p className="font-bold text-rose-400 mb-2">{this.state.error.toString()}</p>}
                  {this.state.errorInfo && <pre className="whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>}
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
