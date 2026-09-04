import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { LogOut, Calendar, Database, User, Building2, ChevronDown, Check } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, activeDepartment, switchDepartment } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    async function loadDepts() {
      try {
        const list = await api.getPublicDepartments();
        setDepartments(list);
      } catch {
        // Silently fail if public departments cannot be loaded
      }
    }
    loadDepts();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDeptDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Department Switcher */}
          <div className="flex items-center gap-4 lg:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                Y
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900 tracking-tight">YenSync</span>
              </div>
            </div>

            {/* Department Badge / Switcher */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDeptDropdownOpen(!deptDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg border border-slate-200 transition-colors"
                title="Switch active department view"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="max-w-[130px] sm:max-w-[200px] truncate">
                  {activeDepartment ? (
                    <>
                      {activeDepartment.name}
                      {activeDepartment.code && (
                        <span className="ml-1 text-[10px] text-emerald-700 font-mono bg-emerald-50 px-1 py-0.2 rounded">
                          {activeDepartment.code}
                        </span>
                      )}
                    </>
                  ) : (
                    'All Departments'
                  )}
                </span>
                {departments.length > 1 && (
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>

              {/* Dropdown Menu */}
              {deptDropdownOpen && departments.length > 0 && (
                <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Department
                  </div>

                  <button
                    onClick={() => {
                      switchDepartment(null);
                      setDeptDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                      !activeDepartment ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-semibold">All Departments</span>
                    {!activeDepartment && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>

                  <div className="my-1 border-t border-slate-100" />

                  {departments.map((dept) => {
                    const isSelected = activeDepartment && String(activeDepartment.id) === String(dept.id);
                    return (
                      <button
                        key={dept.id}
                        onClick={() => {
                          switchDepartment(dept);
                          setDeptDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors ${
                          isSelected ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{dept.name}</span>
                          {dept.code && (
                            <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              {dept.code}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
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
