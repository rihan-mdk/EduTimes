import React, { useState, useEffect, useMemo, useRef } from 'react';
import { debugLogger } from '../utils/debugLogger';
import {
  Terminal,
  AlertCircle,
  AlertTriangle,
  Radio,
  Globe,
  Copy,
  Check,
  Download,
  Trash2,
  X,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Clock,
  Code2,
  Layers,
  FileText,
  ShieldCheck,
  Activity
} from 'lucide-react';

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [logs, setLogs] = useState(() => debugLogger.getLogs());
  const [stats, setStats] = useState(() => debugLogger.getStats());
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'errors' | 'warnings' | 'api'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Environment data
  const envInfo = useMemo(() => {
    if (typeof window === 'undefined') return {};
    return {
      userAgent: navigator.userAgent,
      screen: `${window.screen?.width}x${window.screen?.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine ? 'Online' : 'Offline',
      url: window.location.href,
      mode: import.meta.env.MODE || 'development',
    };
  }, [isOpen]);

  // Subscribe to logger updates
  useEffect(() => {
    const unsubscribe = debugLogger.subscribe((updatedLogs, updatedStats) => {
      setLogs([...updatedLogs]);
      setStats({ ...updatedStats });
    });
    return unsubscribe;
  }, []);

  // Sync panel open status with logger to reset unread counts
  useEffect(() => {
    debugLogger.setPanelOpen(isOpen);
  }, [isOpen]);

  // Keyboard shortcut: Ctrl + D (or Cmd + D) & Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Ctrl + D or Cmd + D
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        // Prevent default browser bookmark shortcut
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Escape to close if open
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomToggle = (e) => {
      if (typeof e.detail?.open === 'boolean') {
        setIsOpen(e.detail.open);
      } else {
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('edutimes:toggle-debug-panel', handleCustomToggle);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('edutimes:toggle-debug-panel', handleCustomToggle);
    };
  }, [isOpen]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Tab filter
      if (activeFilter === 'errors' && log.severity !== 'error') return false;
      if (activeFilter === 'warnings' && log.severity !== 'warn') return false;
      if (activeFilter === 'api' && log.type !== 'API') return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const msg = (log.message || '').toLowerCase();
        const src = (log.source || '').toLowerCase();
        const type = (log.type || '').toLowerCase();
        const url = (log.url || '').toLowerCase();
        const status = log.apiDetails?.status ? String(log.apiDetails.status) : '';
        return (
          msg.includes(query) ||
          src.includes(query) ||
          type.includes(query) ||
          url.includes(query) ||
          status.includes(query)
        );
      }
      return true;
    });
  }, [logs, activeFilter, searchQuery]);

  // Toggle log expanded
  const toggleExpand = (id) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedLogIds(new Set(filteredLogs.map((l) => l.id)));
  };

  const collapseAll = () => {
    setExpandedLogIds(new Set());
  };

  // Copy single log
  const handleCopyLog = (log, e) => {
    e.stopPropagation();
    try {
      const text = JSON.stringify(log, null, 2);
      navigator.clipboard.writeText(text);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard', err);
    }
  };

  // Copy all logs
  const handleCopyAll = () => {
    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        environment: envInfo,
        stats,
        logs: filteredLogs,
      };
      navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.warn('Failed to copy all logs', err);
    }
  };

  // Download logs as JSON file
  const handleDownloadLogs = () => {
    try {
      const exportData = {
        app: 'EduTimes Debug Logs',
        exportedAt: new Date().toISOString(),
        environment: envInfo,
        stats,
        logs: filteredLogs,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edutimes-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Failed to download logs', err);
    }
  };

  const handleClearLogs = () => {
    debugLogger.clearLogs();
    setExpandedLogIds(new Set());
  };

  // Helper badge renderers
  const renderTypeBadge = (type) => {
    switch (type) {
      case 'API':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
            API
          </span>
        );
      case 'REACT':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-pink-500/10 text-pink-400 border border-pink-500/20">
            REACT
          </span>
        );
      case 'PROMISE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            PROMISE
          </span>
        );
      case 'RUNTIME':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">
            RUNTIME
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-800 text-slate-400 border border-slate-700">
            CONSOLE
          </span>
        );
    }
  };

  return (
    <>
      {/* Closed State Floating Indicator (Visible only when panel is closed and unread errors exist) */}
      {!isOpen && stats.unreadCount > 0 && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-900 text-slate-200 border border-red-500/30 rounded-full shadow-2xl backdrop-blur-md transition-all hover:scale-105 select-none group"
          title="Click or press Ctrl+D to open Developer Debug Panel"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <Terminal className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-slate-200">
            {stats.unreadCount} {stats.unreadCount === 1 ? 'error' : 'errors'}
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400 group-hover:text-slate-200">
            Ctrl+D
          </kbd>
        </button>
      )}

      {/* Main Debug Panel Drawer */}
      {isOpen && (
        <div
          data-lenis-prevent
          className={`fixed inset-x-0 bottom-0 z-[99999] flex flex-col bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 text-slate-200 shadow-2xl transition-all duration-200 font-sans select-none ${
            isMaximized ? 'top-0 h-full' : 'h-[460px] max-h-[85vh]'
          }`}
        >
          {/* Top Bar / Header */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 gap-2 shrink-0">
            {/* Title & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-xs">
                <Terminal className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-white tracking-wide uppercase">
                    Edu<span className="text-orange-500">Times</span> DevConsole
                  </span>
                  <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-mono">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-bold">{stats.errors}</span>
                <span className="text-slate-400 text-[11px]">Errors</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-bold">{stats.warnings}</span>
                <span className="text-slate-400 text-[11px]">Warnings</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-purple-400 font-bold">{stats.apiFailures}</span>
                <span className="text-slate-400 text-[11px]">API Fails</span>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title={isMaximized ? 'Restore Height' : 'Maximize Panel'}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-300 transition-colors"
                title="Close (Esc or Ctrl+D)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-toolbar: Filters, Search, and Action Buttons */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-900/40 border-b border-slate-800/60 gap-2 shrink-0">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'all'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                All ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('errors')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'errors'
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-red-300 hover:bg-slate-800/60'
                }`}
              >
                Errors ({stats.errors})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('warnings')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'warnings'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                }`}
              >
                Warnings ({stats.warnings})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('api')}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  activeFilter === 'api'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/60'
                }`}
              >
                API ({stats.apiFailures})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-xs min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter logs by message, path, code..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={expandAll}
                className="px-2 py-1 bg-slate-800/70 hover:bg-slate-800 text-slate-300 rounded text-[11px] font-medium transition-colors"
                title="Expand all visible items"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2 py-1 bg-slate-800/70 hover:bg-slate-800 text-slate-300 rounded text-[11px] font-medium transition-colors"
                title="Collapse all visible items"
              >
                Collapse
              </button>
              <div className="h-4 w-px bg-slate-800 mx-0.5" />
              <button
                type="button"
                onClick={handleCopyAll}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors"
                title="Copy all logs to clipboard as JSON"
              >
                {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadLogs}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors"
                title="Download logs JSON file"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-[11px] font-medium transition-colors"
                title="Clear all stored logs"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Environment & Context Micro-Bar */}
          <div className="flex items-center justify-between px-4 py-1 bg-slate-950 border-b border-slate-900 text-[10px] font-mono text-slate-500 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-3 whitespace-nowrap">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-400" />
                <span className="text-slate-300">{envInfo.url}</span>
              </span>
              <span>•</span>
              <span>Viewport: {envInfo.viewport}</span>
              <span>•</span>
              <span>Status: {envInfo.online}</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap pl-4">
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Payload Redaction Active</span>
              </span>
              <span>•</span>
              <span>Shortcut: Ctrl+D</span>
            </div>
          </div>

          {/* Log List Content (Scrollable) */}
          <div
            data-lenis-prevent
            className="flex-1 overflow-y-auto divide-y divide-slate-800/40 font-mono text-xs"
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-500">
                <Terminal className="w-8 h-8 text-slate-700 mb-2" />
                <p className="font-semibold text-slate-400 text-sm">No Logs Recorded</p>
                <p className="text-xs text-slate-600 mt-1 max-w-sm">
                  {searchQuery
                    ? 'No errors match your current search query.'
                    : 'System is running cleanly without captured runtime errors or failed API requests.'}
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogIds.has(log.id);
                const isError = log.severity === 'error';
                const isCopied = copiedId === log.id;

                return (
                  <div
                    key={log.id}
                    className={`transition-colors ${
                      isError
                        ? 'hover:bg-red-500/[0.03]'
                        : 'hover:bg-amber-500/[0.03]'
                    } ${isExpanded ? 'bg-slate-900/60' : ''}`}
                  >
                    {/* Log Row Summary */}
                    <div
                      onClick={() => toggleExpand(log.id)}
                      className="flex items-start gap-2 px-4 py-2 cursor-pointer select-text"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(log.id);
                        }}
                        className="mt-0.5 text-slate-500 hover:text-slate-300"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Timestamp */}
                      <span className="text-[11px] text-slate-500 shrink-0 pt-0.5">
                        {log.timestamp}
                      </span>

                      {/* Type Badge */}
                      <div className="shrink-0 pt-0.5">{renderTypeBadge(log.type)}</div>

                      {/* Severity Icon */}
                      <div className="shrink-0 pt-0.5">
                        {isError ? (
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>

                      {/* Message Preview */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div
                          className={`truncate font-medium text-xs ${
                            isError ? 'text-red-300' : 'text-amber-300'
                          }`}
                        >
                          {log.message}
                        </div>
                        {log.source && (
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">
                            Source: {log.source} {log.lineno ? `(${log.lineno}:${log.colno})` : ''}
                          </div>
                        )}
                      </div>

                      {/* Copy Single Log Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyLog(log, e)}
                        className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
                        title="Copy log details"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Expanded Detail View */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-1 bg-slate-950/80 border-t border-slate-900 text-xs space-y-3 select-text">
                        {/* Full Error Message */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-orange-400" />
                            <span>Full Error Message</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-red-300 font-mono text-xs break-all leading-relaxed">
                            {log.message}
                          </div>
                        </div>

                        {/* API Details if available */}
                        {log.apiDetails && (
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <Activity className="w-3 h-3 text-purple-400" />
                              <span>API Request / Response Breakdown</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
                              <div>
                                <span className="text-slate-500">Method & Endpoint:</span>
                                <div className="text-slate-200 font-bold mt-0.5">
                                  {log.apiDetails.method} {log.apiDetails.endpoint}
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500">Status & Duration:</span>
                                <div className="text-slate-200 font-bold mt-0.5">
                                  <span className="text-red-400">
                                    {log.apiDetails.status} {log.apiDetails.statusText}
                                  </span>{' '}
                                  ({log.apiDetails.durationMs}ms)
                                </div>
                              </div>

                              {log.apiDetails.requestBody && (
                                <div className="col-span-full mt-1">
                                  <span className="text-slate-500">Request Payload (Sanitized):</span>
                                  <pre className="mt-1 p-2 bg-slate-950 rounded border border-slate-800/80 text-[11px] text-slate-300 overflow-x-auto">
                                    {typeof log.apiDetails.requestBody === 'object'
                                      ? JSON.stringify(log.apiDetails.requestBody, null, 2)
                                      : String(log.apiDetails.requestBody)}
                                  </pre>
                                </div>
                              )}

                              {log.apiDetails.responseBody && (
                                <div className="col-span-full mt-1">
                                  <span className="text-slate-500">Response Body (Sanitized):</span>
                                  <pre className="mt-1 p-2 bg-slate-950 rounded border border-slate-800/80 text-[11px] text-slate-300 overflow-x-auto">
                                    {typeof log.apiDetails.responseBody === 'object'
                                      ? JSON.stringify(log.apiDetails.responseBody, null, 2)
                                      : String(log.apiDetails.responseBody)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Stack Trace */}
                        {log.stack && (
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <Code2 className="w-3 h-3 text-blue-400" />
                              <span>Stack Trace</span>
                            </div>
                            <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre leading-relaxed max-h-48 overflow-y-auto">
                              {log.stack}
                            </pre>
                          </div>
                        )}

                        {/* Additional Context */}
                        {log.context && (
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                              <Layers className="w-3 h-3 text-emerald-400" />
                              <span>Additional Context</span>
                            </div>
                            <pre className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto">
                              {JSON.stringify(log.context, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Metadata Footer */}
                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                          <span>Origin Page: {log.url}</span>
                          <span>Timestamp: {log.isoTime}</span>
                          <span>Log ID: {log.id}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
