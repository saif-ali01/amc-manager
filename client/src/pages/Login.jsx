import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${
      isDark ? 'bg-[#08080c]' : 'bg-gray-50'
    }`}>
      
      {/* ── Global Keyframes ── */}
      <style>{`
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .auth-anim { animation: authFadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .spin-anim { animation: spin 0.7s linear infinite; }
      `}</style>

      {/* ── Background Atmosphere (matches Dashboard) ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={`absolute -top-48 -left-48 w-[700px] h-[700px] rounded-full blur-[160px] transition-colors duration-500 ${
          isDark ? 'bg-teal-500/[0.05]' : 'bg-teal-400/[0.04]'
        }`} />
        <div className={`absolute top-1/4 -right-40 w-[550px] h-[550px] rounded-full blur-[130px] transition-colors duration-500 ${
          isDark ? 'bg-amber-500/[0.035]' : 'bg-amber-400/[0.025]'
        }`} />
        <div className={`absolute -bottom-48 left-1/3 w-[600px] h-[600px] rounded-full blur-[140px] transition-colors duration-500 ${
          isDark ? 'bg-rose-500/[0.025]' : 'bg-rose-400/[0.015]'
        }`} />
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: isDark ? 0.018 : 0.03,
            backgroundImage: isDark
              ? 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)'
              : 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      {/* ── Login Card ── */}
      <div className="relative z-10 w-full max-w-md auth-anim">
        <div className={`rounded-2xl border p-8 sm:p-10 backdrop-blur-2xl shadow-2xl transition-all duration-500 ${
          isDark
            ? 'bg-zinc-900/80 border-white/[0.08] shadow-black/40'
            : 'bg-white/90 border-gray-200/80 shadow-gray-200/50'
        }`}>
          
          {/* Ambient glow behind card */}
          <div className={`absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full blur-[100px] pointer-events-none transition-colors duration-500 ${
            isDark ? 'bg-teal-500/[0.06]' : 'bg-blue-500/[0.04]'
          }`} />

          {/* Header */}
          <div className="relative text-center mb-8">
            <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-lg transition-all duration-500 bg-gradient-to-br ${
              isDark
                ? 'from-teal-400 to-emerald-600 shadow-teal-600/20'
                : 'from-blue-500 to-indigo-600 shadow-blue-600/20'
            }`}>
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <h1 className={`text-2xl font-bold tracking-tight transition-colors duration-500 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Welcome back
            </h1>
            <p className={`mt-2 text-sm transition-colors duration-500 ${
              isDark ? 'text-gray-500' : 'text-gray-500'
            }`}>
              Sign in to your AMC Manager account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="relative space-y-5">
            {/* Email */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-[0.12em] mb-1.5 transition-colors duration-500 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className={`w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 focus:outline-none ${
                  isDark
                    ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
                    : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
                }`}
              />
            </div>

            {/* Password */}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-[0.12em] mb-1.5 transition-colors duration-500 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={`w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 focus:outline-none ${
                  isDark
                    ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
                    : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
                }`}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] ${
                isDark
                  ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-zinc-950 hover:shadow-lg hover:shadow-teal-500/25 hover:brightness-110'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:brightness-110'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 spin-anim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <p className={`mt-8 text-center text-sm transition-colors duration-500 ${
            isDark ? 'text-gray-500' : 'text-gray-500'
          }`}>
            Don't have an account?{' '}
            <Link 
              to="/register" 
              className={`font-semibold transition-colors duration-200 ${
                isDark ? 'text-teal-400 hover:text-teal-300' : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}