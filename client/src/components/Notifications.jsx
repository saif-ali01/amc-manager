import { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';

export default function Notifications() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [expired, setExpired] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // For animation
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const res = await API.get('/items');
        const now = new Date();
        const soon = [];
        const past = [];

        res.data.forEach((item) => {
          const end = new Date(item.endDate);
          const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

          if (end < now) {
            past.push({ ...item, diffDays });
          } else if (diffDays <= 30 && diffDays > 0) {
            soon.push({ ...item, diffDays });
          }
        });

        setExpiringSoon(soon);
        setExpired(past);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [user]);

  // Handle animation states
  const toggleDropdown = () => {
    if (showDropdown) {
      setIsVisible(false);
      setTimeout(() => setShowDropdown(false), 200); // Wait for close animation
    } else {
      setShowDropdown(true);
      requestAnimationFrame(() => setIsVisible(true));
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (showDropdown) {
          setIsVisible(false);
          setTimeout(() => setShowDropdown(false), 200);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const totalCount = expiringSoon.length + expired.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ── Trigger Button ── */}
      <button
        onClick={toggleDropdown}
        className={`relative w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
          isDark 
            ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]' 
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
        }`}
        title="Notifications"
      >
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        
        {/* Badge */}
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-rose-500 rounded-full shadow-lg shadow-rose-500/30">
            {totalCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ── */}
      {showDropdown && (
        <div 
          className={`absolute right-0 mt-2.5 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden transition-all duration-200 origin-top-right ${
            isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1'
          } ${
            isDark
              ? 'bg-zinc-900/95 border-white/[0.08] backdrop-blur-2xl shadow-black/60'
              : 'bg-white/95 border-gray-200/80 backdrop-blur-2xl shadow-gray-300/40'
          }`}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            isDark ? 'border-white/[0.05]' : 'border-gray-100'
          }`}>
            <h3 className={`text-sm font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Notifications
            </h3>
            {totalCount > 0 && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-white/[0.05] text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {totalCount} new
              </span>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto custom-scroll">
            
            {/* Expiring Soon Section */}
            {expiringSoon.length > 0 && (
              <div>
                <div className={`px-4 py-2 flex items-center gap-2 ${
                  isDark ? 'bg-amber-500/[0.05]' : 'bg-amber-50'
                }`}>
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Expiring Soon ({expiringSoon.length})
                  </span>
                </div>
                {expiringSoon.map((item) => (
                  <div 
                    key={item._id} 
                    className={`px-4 py-3 flex items-start gap-3 transition-colors duration-150 ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="mt-1 w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isDark ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {item.name}
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="ml-2 font-semibold text-amber-500">
                          {item.diffDays}d left
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Expired Section */}
            {expired.length > 0 && (
              <div>
                <div className={`px-4 py-2 flex items-center gap-2 ${
                  isDark ? 'bg-rose-500/[0.05]' : 'bg-rose-50'
                }`}>
                  <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                    Expired ({expired.length})
                  </span>
                </div>
                {expired.map((item) => (
                  <div 
                    key={item._id} 
                    className={`px-4 py-3 flex items-start gap-3 transition-colors duration-150 ${
                      isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="mt-1 w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isDark ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {item.name}
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {new Date(item.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="ml-2 font-semibold text-rose-500">
                          {Math.abs(item.diffDays)}d ago
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {totalCount === 0 && (
              <div className="px-4 py-10 flex flex-col items-center justify-center text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                }`}>
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className={`text-sm font-medium ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  All caught up!
                </p>
                <p className={`text-xs mt-1 ${
                  isDark ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  No items require attention right now.
                </p>
              </div>
            )}
          </div>

          {/* Footer Link to Dashboard */}
          {totalCount > 0 && (
            <div className={`border-t px-4 py-2.5 ${
              isDark ? 'border-white/[0.05]' : 'border-gray-100'
            }`}>
              <Link
                to="/"
                onClick={() => {
                  setIsVisible(false);
                  setTimeout(() => setShowDropdown(false), 200);
                }}
                className={`block text-center text-xs font-semibold transition-colors ${
                  isDark ? 'text-teal-400 hover:text-teal-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                View all in Dashboard
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}