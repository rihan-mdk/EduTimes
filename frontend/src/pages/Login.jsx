import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Lock, User, Loader2, AlertCircle, Calendar, Building2, ArrowLeft, Plus } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const { login } = useAuth();

  // step: 'dept' | 'login' | 'create'
  const [step, setStep] = useState('dept');
  const [deptCodeInput, setDeptCodeInput] = useState('');
  const [foundDept, setFoundDept] = useState(null); // { id, name, code }

  // Login fields
  const [facultyCode, setFacultyCode] = useState('');
  const [password, setPassword] = useState('');

  // Create dept fields
  const [deptName, setDeptName] = useState('');
  const [adminFacultyCode, setAdminFacultyCode] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Step 1: Check dept code ───────────────────────────────
  const handleCheckDept = async (e) => {
    e.preventDefault();
    setError('');
    const code = deptCodeInput.trim().toUpperCase();
    if (!code) {
      setError('Please enter a department code.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.checkDepartment(code);
      if (result.exists) {
        setFoundDept(result);
        setStep('login');
      } else {
        setFoundDept(null);
        setDeptName('');
        setAdminFacultyCode('');
        setAdminName('');
        setAdminPassword('');
        setStep('create');
      }
    } catch (err) {
      setError(err.message || 'Failed to check department. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2a: Login ────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!facultyCode.trim() || !password) {
      setError('Please enter both faculty code and password.');
      return;
    }
    setLoading(true);
    try {
      const user = await login(facultyCode.trim(), password, null, foundDept.code);
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.data?.error || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2b: Create dept + admin ──────────────────────────
  const handleSetup = async (e) => {
    e.preventDefault();
    setError('');
    if (!deptName.trim() || !adminFacultyCode.trim() || !adminName.trim() || !adminPassword) {
      setError('All fields are required to set up the department.');
      return;
    }
    setLoading(true);
    try {
      const result = await api.setupDepartment({
        department_name: deptName.trim(),
        department_code: deptCodeInput.trim().toUpperCase(),
        faculty_code: adminFacultyCode.trim(),
        admin_name: adminName.trim(),
        password: adminPassword,
      });
      // setupDepartment returns token + user — call login context directly
      const user = await login(adminFacultyCode.trim(), adminPassword, null, deptCodeInput.trim().toUpperCase());
      if (onLoginSuccess) onLoginSuccess(user);
    } catch (err) {
      setError(err.data?.error || err.message || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('dept');
    setError('');
    setFoundDept(null);
    setFacultyCode('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-emerald-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">YenSync</h1>
        <p className="mt-1 text-sm text-slate-500">College Department Timetable &amp; Scheduling System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-2xl sm:px-10">

          {/* ── STEP 1: Dept Code ── */}
          {step === 'dept' && (
            <>
              <h2 className="text-base font-bold text-slate-800 mb-1">Enter your Department</h2>
              <p className="text-xs text-slate-500 mb-5">Use your department code to access the portal</p>

              <form className="space-y-4" onSubmit={handleCheckDept}>
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department Code
                  </label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. AIML, CSE, MECH"
                      value={deptCodeInput}
                      onChange={(e) => setDeptCodeInput(e.target.value.toUpperCase())}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono font-semibold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">Don't have a department yet? Enter a new code to create one.</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : 'Continue →'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2a: Login ── */}
          {step === 'login' && foundDept && (
            <>
              {/* Back + Dept badge */}
              <div className="flex items-center gap-3 mb-5">
                <button type="button" onClick={goBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">{foundDept.name}</span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                    {foundDept.code}
                  </span>
                </div>
              </div>

              <h2 className="text-base font-bold text-slate-800 mb-4">Sign in to your account</h2>

              <form className="space-y-4" onSubmit={handleLogin}>
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Faculty / Admin Code</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. F01"
                      value={facultyCode}
                      onChange={(e) => setFacultyCode(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Password</label>
                  <div className="relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Authenticating...</> : 'Sign In to Department Portal'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2b: Create Dept ── */}
          {step === 'create' && (
            <>
              {/* Back + new code badge */}
              <div className="flex items-center gap-3 mb-4">
                <button type="button" onClick={goBack} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">New Department</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">
                    {deptCodeInput}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Department <span className="font-mono font-bold text-slate-700">{deptCodeInput}</span> doesn't exist yet.
                Fill in the details below to create it and your first admin account.
              </p>

              <form className="space-y-3" onSubmit={handleSetup}>
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department Info</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Computer Science Engineering"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code</label>
                    <input
                      type="text"
                      value={deptCodeInput}
                      readOnly
                      className="block w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-mono font-semibold text-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">First Admin Account</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. F01"
                      value={adminFacultyCode}
                      onChange={(e) => setAdminFacultyCode(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Kumar"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : '🏛️ Create Department & Sign In'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
