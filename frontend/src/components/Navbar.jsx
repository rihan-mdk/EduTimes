import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Database, User, Building2 } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, activeDepartment } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand + Static Dept Badge + Nav Tabs */}
          <div className="flex items-center gap-4 lg:gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                E
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">EduTimes</span>
            </div>

            {/* Static Department Badge — informational only, not clickable */}
            {activeDepartment && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="max-w-[130px] sm:max-w-[200px] truncate">{activeDepartment.name}</span>
                {activeDepartment.code && (
                  <span className="text-[10px] font-mono font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">
                    {activeDepartment.code}
                  </span>
                )}
              </div>
            )}

            {/* Admin Nav Tabs */}
            {user?.role === 'admin' && (
              <nav className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('timetable')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'timetable'
                      ? 'bg-orange-50 text-orange-600 font-semibold'
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
                      ? 'bg-orange-50 text-orange-600 font-semibold'
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
                  <span className={`capitalize font-medium ${user?.role === 'admin' ? 'text-purple-600' : 'text-orange-500'}`}>
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
                activeTab === 'timetable' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Timetable Grid
            </button>
            <button
              onClick={() => setActiveTab('masterdata')}
              className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md ${
                activeTab === 'masterdata' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700'
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
