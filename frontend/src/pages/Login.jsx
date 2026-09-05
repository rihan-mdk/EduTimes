import React, { useState, useEffect } from 'react';
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
  const [bgLoaded, setBgLoaded] = useState(false);

  // â”€â”€â”€ Step 1: Check dept code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Step 2a: Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Step 2b: Create dept + admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      // setupDepartment returns token + user â€” call login context directly
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative">
      {/* Hidden image preloader — triggers fade-in once background is ready */}
      <img
        src="/login-bg.webp"
        alt=""
        aria-hidden="true"
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        onLoad={() => setBgLoaded(true)}
      />

      {/* Full-screen background with fade-in */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/login-bg.webp')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: bgLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease-in-out',
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-3xl px-8 py-10 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          {/* Logo + Brand */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-11 h-11 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg mb-3">
              <Calendar className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">EduTimes</h1>
            <p className="mt-1 text-xs text-white/60 tracking-wide">Department Timetable &amp; Scheduling</p>
          </div>

          {/* STEP 1: Dept Code */}
          {step === 'dept' && (
            <>
              <h2 className="text-base font-bold text-white mb-1">Enter your Department</h2>
              <p className="text-xs text-white/60 mb-6">Use your department code to access the portal</p>
              <form className="space-y-5" onSubmit={handleCheckDept}>
                {error && (
                  <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl flex items-start gap-2.5 text-rose-100 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">
                    Department Code
                  </label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. AIML, CSE, MECH"
                      value={deptCodeInput}
                      onChange={(e) => setDeptCodeInput(e.target.value.toUpperCase())}
                      className="block w-full pl-10 pr-3 py-3 rounded-xl text-sm text-white font-mono font-semibold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-white/45">Don't have a department yet? Enter a new code to create one.</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 transition-all shadow-lg"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : 'Continue →'}
                </button>
              </form>
            </>
          )}

          {/* STEP 2a: Login */}
          {step === 'login' && foundDept && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button type="button" onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <Building2 className="w-3.5 h-3.5 text-orange-300" />
                  <span className="text-sm font-semibold text-white">{foundDept.name}</span>
                  <span className="text-[10px] font-mono font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">
                    {foundDept.code}
                  </span>
                </div>
              </div>
              <h2 className="text-base font-bold text-white mb-6">Sign in to your account</h2>
              <form className="space-y-5" onSubmit={handleLogin}>
                {error && (
                  <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl flex items-start gap-2.5 text-rose-100 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">Faculty / Admin Code</label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. F01"
                      value={facultyCode}
                      onChange={(e) => setFacultyCode(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 rounded-xl text-sm text-white font-mono placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative rounded-xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/50">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 rounded-xl text-sm text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 transition-all shadow-lg"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Authenticating...</> : 'Sign In to Department Portal'}
                </button>
              </form>
            </>
          )}

          {/* STEP 2b: Create Dept */}
          {step === 'create' && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <button type="button" onClick={goBack} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}
                >
                  <Plus className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-sm font-semibold text-amber-100">New Department</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded">
                    {deptCodeInput}
                  </span>
                </div>
              </div>
              <p className="text-xs text-white/60 mb-5">
                Department <span className="font-mono font-bold text-white">{deptCodeInput}</span> doesn't exist yet.
                Fill in the details below to create it and your first admin account.
              </p>
              <form className="space-y-4" onSubmit={handleSetup}>
                {error && (
                  <div className="p-3 bg-rose-500/20 border border-rose-400/40 rounded-xl flex items-start gap-2.5 text-rose-100 text-sm">
                    <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Department Info</p>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Department Name</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Computer Science Engineering"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Department Code</label>
                    <input
                      type="text"
                      value={deptCodeInput}
                      readOnly
                      className="block w-full px-3 py-2.5 rounded-lg text-sm font-mono font-semibold text-white/50 cursor-not-allowed"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>
                <div
                  className="rounded-xl p-4 space-y-3"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider">First Admin Account</p>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Admin Code</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. F01"
                      value={adminFacultyCode}
                      onChange={(e) => setAdminFacultyCode(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-lg text-sm font-mono text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Kumar"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/80 mb-1.5">Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="block w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-white/35 outline-none transition-all focus:ring-2 focus:ring-orange-400"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 transition-all shadow-lg"
                >
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Department & Sign In'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}