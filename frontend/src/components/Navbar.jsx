import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Calendar, Database, User, Building2, ChevronDown } from 'lucide-react';
import ProfileModal from './ProfileModal';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, activeDepartment } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Compute initials for user avatar circle
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
    : 'AP';

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-slate-200/60 shadow-xs supports-[backdrop-filter]:bg-white/65 transition-all">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* Brand + Department Pill + Nav Tabs */}
          <div className="flex items-center gap-4 lg:gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-orange-500/20">
                E
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-slate-900 leading-none">
                  Edu<span className="text-orange-600">Times</span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                  Academic Suite
                </span>
              </div>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden md:block" />

            {/* Department Selector Pill */}
            {activeDepartment && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/70 hover:bg-white/90 border border-slate-200/70 rounded-xl text-xs text-slate-700 font-medium transition shadow-xs backdrop-blur-xs cursor-default">
                <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="max-w-[150px] md:max-w-[240px] truncate">{activeDepartment.name}</span>
                {activeDepartment.code && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100/90 text-orange-800 font-bold text-[10px]">
                    {activeDepartment.code}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            )}

            {/* Admin View Navigation Tabs */}
            {user?.role === 'admin' && (
              <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/70 p-1 rounded-xl border border-slate-200/50 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('timetable')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    activeTab === 'timetable'
                      ? 'bg-white text-orange-600 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Timetable Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('masterdata')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                    activeTab === 'masterdata'
                      ? 'bg-white text-orange-600 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>Master Data</span>
                </button>
              </nav>
            )}
          </div>

          {/* User info & Logout */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsProfileOpen(true)}
              title="Edit Profile & Password"
              className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full hover:bg-white/80 transition border border-transparent hover:border-slate-200/70 group cursor-pointer text-right"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs">
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-800 leading-tight">
                  {user?.name}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 leading-tight mt-0.5">
                  <span className="font-mono text-slate-500 font-medium">
                    {user?.faculty_code}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-orange-600 font-medium capitalize">
                    {user?.role}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={logout}
              title="Sign Out"
              className="p-2 sm:px-3 sm:py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 bg-white/50 backdrop-blur-xs rounded-xl transition border border-slate-200/60 flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
            >
              <LogOut className="w-4 h-4" />
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
              type="button"
              onClick={() => setActiveTab('timetable')}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'timetable' ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Timetable Grid
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('masterdata')}
              className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'masterdata' ? 'bg-orange-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
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
