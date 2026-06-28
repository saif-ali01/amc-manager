import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Notifications from './Notifications';

/* ═══════════════════════════════════════════
   Animated Theme Toggle (Sun ↔ Moon)
   ═══════════════════════════════════════════ */
function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative rounded-full transition-all duration-500 cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2
        focus-visible:ring-offset-gray-900
        ${compact ? 'w-11 h-6' : 'w-14 h-7'}
      `}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
          : 'linear-gradient(135deg, #fde68a, #f59e0b)',
        boxShadow: isDark
          ? '0 0 20px rgba(99,102,241,0.15), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 0 20px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      <div
        className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full blur-lg transition-all duration-500 pointer-events-none"
        style={{
          left: isDark ? 'calc(100% - 20px)' : '4px',
          background: isDark ? 'rgba(129,140,248,0.35)' : 'rgba(251,191,36,0.5)',
        }}
      />
      <div
        className={`
          absolute top-0.5 rounded-full bg-white shadow-lg
          flex items-center justify-center
          transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
          ${compact ? 'w-5 h-5' : 'w-6 h-6'}
        `}
        style={{ left: isDark ? `calc(100% - ${compact ? 22 : 26}px)` : '2px' }}
      >
        <svg
          className={`w-3 h-3 text-amber-500 transition-all duration-500 ${
            isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
          style={{ position: 'absolute' }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
        <svg
          className={`w-3 h-3 text-indigo-500 transition-all duration-500 ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'
          }`}
          style={{ position: 'absolute' }}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════
   User Avatar (initials)
   ═══════════════════════════════════════════ */
function Avatar({ name, isDark, size = 'md' }) {
  const initials =
    name
      ?.split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  const sizes = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-11 h-11 text-sm' };

  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold tracking-wide transition-all duration-500 ${
        isDark
          ? 'bg-gradient-to-br from-teal-500/20 to-emerald-600/20 text-teal-300 border border-teal-500/20'
          : 'bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 border border-blue-200/60'
      }`}
    >
      {initials}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Navbar Component
   ═══════════════════════════════════════════ */
export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (!user) return null;

  /* ── Theme-aware tokens ── */
  const navBg = isDark
    ? 'bg-[#0c0c14]/80 border-white/[0.05]'
    : 'bg-white/80 border-gray-200/60';
  const navShadow = scrolled
    ? isDark
      ? 'shadow-lg shadow-black/30'
      : 'shadow-lg shadow-gray-200/50'
    : '';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const hoverBg = isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-100';
  const dividerColor = isDark ? 'bg-white/[0.06]' : 'bg-gray-200/80';
  const accentLine = isDark
    ? 'bg-gradient-to-r from-transparent via-teal-500/25 to-transparent'
    : 'bg-gradient-to-r from-transparent via-blue-500/20 to-transparent';
  const logoGradient = isDark
    ? 'from-teal-400 to-emerald-600'
    : 'from-blue-500 to-indigo-600';
  const logoShadow = isDark ? 'shadow-teal-600/20' : 'shadow-blue-600/20';
  const logoAccent = isDark ? 'text-teal-400' : 'text-blue-600';
  const logoutStyle = isDark
    ? 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/25'
    : 'text-red-600 hover:bg-red-50 border border-red-200/60 hover:border-red-300';

  return (
    <>
      <nav
        className={`sticky top-0 z-40 border-b backdrop-blur-2xl transition-all duration-300 ${navBg} ${navShadow}`}
      >
        <div className={`h-px ${accentLine} transition-opacity duration-500`} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${logoGradient} shadow-lg ${logoShadow} transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl`}
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <span className={`text-lg font-bold tracking-tight ${textPrimary} hidden sm:inline`}>
              AMC{' '}
              <span className={logoAccent}>Manager</span>
            </span>
          </Link>

          {/* ── Desktop Right Section ── */}
          <div className="hidden md:flex items-center gap-1.5">
            <ThemeToggle />

            <div className={`w-px h-7 mx-2 ${dividerColor} transition-colors duration-500`} />

            {/* Notifications */}
            <div className={`${hoverBg} rounded-xl p-2 transition-colors duration-200`}>
              <Notifications />
            </div>

            <div className={`w-px h-7 mx-1 ${dividerColor} transition-colors duration-500`} />

            {/* ── User Info (clickable → settings) ── */}
            <Link
              to="/settings"
              className="flex items-center gap-2.5 ml-1 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
            >
              <Avatar name={user.name} isDark={isDark} />
              <div className="flex flex-col">
                <span className={`text-sm font-semibold leading-tight ${textPrimary}`}>
                  {user.name}
                </span>
                <span className={`text-[10px] ${textMuted} tracking-wide`}>
                  {user.email || 'Active'}
                </span>
              </div>
            </Link>

            <div className={`w-px h-7 mx-1 ${dividerColor} transition-colors duration-500`} />

            {/* Logout */}
            <button
              onClick={logout}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer ${logoutStyle}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className={`md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${hoverBg}`}
            aria-label="Toggle menu"
          >
            <div className="relative w-5 h-4 flex flex-col justify-between">
              <span
                className={`block h-0.5 rounded-full transition-all duration-300 origin-center ${
                  mobileOpen
                    ? `${isDark ? 'bg-white' : 'bg-gray-900'} rotate-45 translate-y-[7px]`
                    : `${isDark ? 'bg-gray-400' : 'bg-gray-600'}`
                }`}
              />
              <span
                className={`block h-0.5 rounded-full transition-all duration-300 ${
                  mobileOpen
                    ? 'opacity-0 scale-x-0'
                    : `${isDark ? 'bg-gray-400' : 'bg-gray-600'}`
                }`}
              />
              <span
                className={`block h-0.5 rounded-full transition-all duration-300 origin-center ${
                  mobileOpen
                    ? `${isDark ? 'bg-white' : 'bg-gray-900'} -rotate-45 -translate-y-[7px]`
                    : `${isDark ? 'bg-gray-400' : 'bg-gray-600'}`
                }`}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* ═══ Mobile Slide-Down Menu ═══ */}
      <div
        ref={menuRef}
        className={`
          md:hidden fixed top-16 left-0 right-0 z-30
          border-b backdrop-blur-2xl transition-all duration-400
          ${navBg}
          ${mobileOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'}
        `}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="px-5 py-5 space-y-1">
          {/* ── User Card (clickable → settings) ── */}
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-3 rounded-xl ${isDark ? 'bg-white/[0.03]' : 'bg-gray-50'} hover:bg-white/[0.06] transition-colors`}
          >
            <Avatar name={user.name} isDark={isDark} size="lg" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${textPrimary}`}>{user.name}</p>
              <p className={`text-xs truncate ${textMuted}`}>{user.email || 'Active session'}</p>
            </div>
          </Link>

          <div className={`h-px ${dividerColor} my-2`} />

          {/* Theme Toggle Row */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-2.5">
              {isDark ? (
                <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              ) : (
                <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              )}
              <span className={`text-sm font-medium ${textSecondary}`}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <ThemeToggle compact />
          </div>

          {/* Notifications Row */}
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${hoverBg} transition-colors`}>
            <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span className={`text-sm font-medium ${textSecondary}`}>Notifications</span>
          </div>

          {/* Settings Row */}
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${hoverBg} transition-colors`}
          >
            <svg className={`w-4 h-4 ${textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={`text-sm font-medium ${textSecondary}`}>Settings</span>
          </Link>

          <div className={`h-px ${dividerColor} my-2`} />

          {/* Logout */}
          <button
            onClick={() => {
              logout();
              setMobileOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${logoutStyle}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Mobile Backdrop ── */}
      <div
        className={`md:hidden fixed inset-0 top-16 z-20 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />
    </>
  );
}