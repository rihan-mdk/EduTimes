import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Database, LayoutDashboard, User } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                Y
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">YenSync</span>
                <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {user?.department_name || 'Department Timetable'}
                </span>
              </div>
            </div>

            {/* Admin Nav Tabs */}
            {user?.role === 'admin' && (
              <nav className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('timetable')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'timetable'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Timetable Grid
                </button>
                <button
                  onClick={() => setActiveTab('masterdata')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'masterdata'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  Master Data
                </button>
              </nav>
            )}
          </div>

          {/* User info & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 text-right">
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-900 leading-none">{user?.name}</div>
                <div className="text-xs text-slate-600 mt-1 flex items-center justify-end gap-1.5">
                  <span className="font-mono text-slate-600">{user?.faculty_code}</span>
                  <span className="text-slate-300">•</span>
                  <span className={`capitalize font-medium ${user?.role === 'admin' ? 'text-purple-600' : 'text-emerald-600'}`}>
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <User className="w-4 h-4" />
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        {user?.role === 'admin' && (
          <div className="flex md:hidden border-t border-slate-100 py-2 gap-2">
            <button
              onClick={() => setActiveTab('timetable')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md ${
                activeTab === 'timetable' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Timetable Grid
            </button>
            <button
              onClick={() => setActiveTab('masterdata')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md ${
                activeTab === 'masterdata' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Master Data
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
