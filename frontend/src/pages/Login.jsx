import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Loader2, AlertCircle, Calendar } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const { login } = useAuth();
  const [facultyCode, setFacultyCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!facultyCode.trim() || !password) {
      setError('Please enter both faculty code and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(facultyCode.trim(), password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-md mb-4">
          <Calendar className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">YenSync</h1>
        <p className="mt-1 text-sm text-slate-600">College Department Timetable & Scheduling System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Faculty Code
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. ADM001 or FAC101"
                  value={facultyCode}
                  onChange={(e) => setFacultyCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
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
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </button>
          </form>

          {/* Quick Demo Credentials helper */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Demo Accounts:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setFacultyCode('ADM001'); setPassword('Password@123'); }}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <span className="font-bold text-slate-800 block">Admin</span>
                <span className="font-mono text-slate-600 block">ADM001 / Password@123</span>
              </button>
              <button
                type="button"
                onClick={() => { setFacultyCode('FAC101'); setPassword('Password@123'); }}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <span className="font-bold text-slate-800 block">Faculty</span>
                <span className="font-mono text-slate-600 block">FAC101 / Password@123</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
