import React from 'react';
import { debugLogger } from '../utils/debugLogger';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

export class DebugErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    debugLogger.logReactError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleOpenDebug = () => {
    debugLogger.setPanelOpen(true);
    // Dispatch a custom event to toggle the debug panel state
    window.dispatchEvent(new CustomEvent('edutimes:toggle-debug-panel', { detail: { open: true } }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-4 leading-relaxed">
              A component encountered an unexpected error. Details have been captured in the developer debug console.
            </p>

            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-3 text-xs font-mono text-red-300 break-words mb-5 max-h-32 overflow-y-auto">
              {this.state.error?.message || 'Unknown render error'}
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleOpenDebug}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all"
              >
                <Terminal className="w-4 h-4" />
                <span>Open Debug (Ctrl+D)</span>
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
