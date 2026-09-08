import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Database, User, Building2 } from 'lucide-react';
import ProfileModal from './ProfileModal';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, activeDepartment } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

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

          {/* User info, Settings & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsProfileOpen(true)}
              title="Edit Profile & Password"
              className="flex items-center gap-2.5 text-right p-1.5 rounded-lg hover:bg-slate-100 transition-colors group cursor-pointer"
            >
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-slate-900 leading-none group-hover:text-orange-600 transition-colors">
                  {user?.name}
                </div>
                <div className="text-xs text-slate-600 mt-1 flex items-center justify-end gap-1.5">
                  <span className="font-mono text-slate-600 group-hover:text-orange-600 transition-colors font-medium">
                    {user?.faculty_code}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className={`capitalize font-medium ${user?.role === 'admin' ? 'text-purple-600' : 'text-orange-500'}`}>
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-orange-100 border border-slate-200 group-hover:border-orange-300 flex items-center justify-center text-slate-600 group-hover:text-orange-600 transition-all">
                <User className="w-4 h-4" />
              </div>
            </button>

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

        {/* Profile & Password Modal */}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

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
