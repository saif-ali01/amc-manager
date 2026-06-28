import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import API from '../services/api';
import ItemForm from '../components/ItemForm';
import ItemList from '../components/ItemList';
import { useTheme } from '../context/ThemeContext';
import * as XLSX from 'xlsx';          // Excel
import { saveAs } from 'file-saver';  // CSV download

/* ═══════════════════════════════════════════
   Animated Counter Hook
   ═══════════════════════════════════════════ */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const from = prev.current;
    const delta = target - from;
    if (delta === 0) return;
    const start = performance.now();
    let raf;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t === 1 ? 1 : 1 - Math.pow(2, -12 * t);
      setValue(Math.round(from + delta * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/* ═══════════════════════════════════════════
   Health Ring (SVG Circular Progress)
   ═══════════════════════════════════════════ */
function HealthRing({ percentage, isDark, size = 108 }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const targetOffset = circ * (1 - percentage / 100);
  const color = percentage >= 70 ? '#34d399' : percentage >= 40 ? '#fbbf24' : '#fb7185';
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const id = setTimeout(() => setOffset(targetOffset), 150);
    return () => clearTimeout(id);
  }, [targetOffset]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}
          strokeWidth="7"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1), stroke 0.5s',
            filter: `drop-shadow(0 0 6px ${color}44)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold tabular-nums leading-none" style={{ color }}>
          {percentage}%
        </span>
        <span className={`text-[9px] uppercase tracking-[0.2em] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          healthy
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════ */
function StatCard({ icon, label, count, accentBg, gradientFrom, glowColor, textColor, isDark }) {
  const animated = useCountUp(count);
  return (
    <div className="group relative rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl cursor-default">
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradientFrom} to-transparent opacity-50 group-hover:opacity-90 transition-opacity duration-500`} />
      <div className={`absolute -top-10 -right-10 w-28 h-28 ${glowColor} rounded-full blur-3xl opacity-10 group-hover:opacity-25 transition-opacity duration-500`} />
      <div className={`relative backdrop-blur-xl rounded-2xl p-5 sm:p-6 flex flex-col gap-3 transition-colors duration-500 ${
        isDark ? 'bg-zinc-900/90' : 'bg-white/90 shadow-sm shadow-gray-200/50'
      }`}>
        <div className="flex items-center justify-between">
          <div className={`w-11 h-11 rounded-xl ${accentBg} flex items-center justify-center shadow-lg`}>
            {icon}
          </div>
          <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${textColor}`}>
            {animated}
          </span>
        </div>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════ */
export default function Dashboard() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('endDate');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  const searchRef = useRef(null);

  /* ── Fetch ── */
  const fetchItems = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await API.get('/items');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch items', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── Derived data ── */
  const now = new Date();
  const activeCount = items.filter(i => {
    const d = (new Date(i.endDate) - now) / (1000 * 60 * 60 * 24);
    return new Date(i.endDate) >= now && d > 30;
  }).length;
  const expiringCount = items.filter(i => {
    const d = Math.ceil((new Date(i.endDate) - now) / (1000 * 60 * 60 * 24));
    return d <= 30 && d > 0;
  }).length;
  const expiredCount = items.filter(i => new Date(i.endDate) < now).length;
  const healthPercent = items.length > 0 ? Math.round((activeCount / items.length) * 100) : 0;

  /* ── Filtered + Sorted ── */
  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter((item) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q ||
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q);

      let matchesStatus = true;
      const end = new Date(item.endDate);
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));

      if (statusFilter === 'active') matchesStatus = end >= now && diff > 30;
      else if (statusFilter === 'expiring') matchesStatus = diff <= 30 && diff > 0;
      else if (statusFilter === 'expired') matchesStatus = end < now;

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      let vA, vB;
      if (sortBy === 'name') {
        vA = a.name?.toLowerCase() || '';
        vB = b.name?.toLowerCase() || '';
      } else {
        vA = new Date(a.endDate).getTime();
        vB = new Date(b.endDate).getTime();
      }
      if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
      if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, searchTerm, statusFilter, sortBy, sortOrder]);

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || sortBy !== 'endDate' || sortOrder !== 'asc';

  /* ── Handlers ── */
  const handleAdd = () => {
    setEditItem(null);
    setShowForm(true);
    requestAnimationFrame(() => setModalOpen(true));
  };
  const handleEdit = (item) => {
    setEditItem(item);
    setShowForm(true);
    requestAnimationFrame(() => setModalOpen(true));
  };
  const handleFormClose = () => {
    setModalOpen(false);
    setTimeout(() => { setShowForm(false); setEditItem(null); }, 300);
  };
  const handleFormSaved = () => { fetchItems(); handleFormClose(); };
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortBy('endDate');
    setSortOrder('asc');
    searchRef.current?.focus();
  };
  const handleSortField = (field) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && showForm) handleFormClose();
      if (e.key === 'r' && !showForm && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        fetchItems();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm, fetchItems]);

  /* ── Filter pill data ── */
  const filters = [
    { key: 'all', label: 'All', count: items.length },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'expiring', label: 'Expiring', count: expiringCount },
    { key: 'expired', label: 'Expired', count: expiredCount },
  ];

  /* ═══════════════════════════════════════════
     EXPORT FUNCTIONS (Excel & CSV only)
     ═══════════════════════════════════════════ */
  const getExportData = () => {
    return filteredAndSortedItems.map(item => ({
      Name: item.name || '',
      Type: item.type?.name || '',
      Provider: item.provider?.name || '',
      Company: item.company?.name || '',
      Location: item.location?.name || '',
      StartDate: item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN') : '',
      EndDate: item.endDate ? new Date(item.endDate).toLocaleDateString('en-IN') : '',
      Cost: item.cost ? `₹${item.cost.toLocaleString('en-IN')}` : '',
      Status:
        new Date(item.endDate) < new Date() ? 'Expired' :
        Math.ceil((new Date(item.endDate) - new Date()) / (1000 * 60 * 60 * 24)) <= 30 ? 'Expiring' : 'Active'
    }));
  };

  const exportToCSV = () => {
    const data = getExportData();
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `amc-items-${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportToExcel = () => {
    const data = getExportData();
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
    XLSX.writeFile(wb, `amc-items-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  /* ════════════════════════════════════════
     RENDER
     ════════════════════════════════════════ */
  return (
    <div className={`min-h-screen transition-colors duration-500 ${
      isDark ? 'bg-[#08080c] text-gray-100 selection:bg-teal-500/30' : 'bg-gray-50 text-gray-900 selection:bg-blue-500/20'
    }`}>

      {/* ── Global Keyframes + Scrollbar ── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .anim-up   { animation: fadeUp  0.7s cubic-bezier(0.22,1,0.36,1) both; }
        .anim-slide { animation: slideUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .spin-anim  { animation: spin 0.7s linear infinite; }
        .pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }

        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        [data-theme="dark"] .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 9px; }
        [data-theme="dark"] .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        [data-theme="light"] .custom-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.08); border-radius: 9px; }
        [data-theme="light"] .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.15); }
      `}</style>

      {/* ── Background Atmosphere ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-500">
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

      {/* ── Page Content ── */}
      <div className="relative z-10">

        {/* ═══ STICKY HEADER ═══ */}
        <header className={`sticky top-0 z-40 border-b backdrop-blur-2xl transition-all duration-500 ${
          isDark
            ? 'border-white/[0.05] bg-[#08080c]/75'
            : 'border-gray-200/60 bg-white/75'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo + Title */}
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-all duration-500 bg-gradient-to-br ${
                isDark
                  ? 'from-teal-400 to-emerald-600 shadow-teal-600/20'
                  : 'from-blue-500 to-indigo-600 shadow-blue-600/20'
              }`}>
                <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <h1 className={`text-lg sm:text-xl font-bold tracking-tight transition-colors duration-500 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Dashboard</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchItems}
                disabled={isRefreshing}
                className={`h-9 px-3.5 sm:px-4 flex items-center gap-2 text-[13px] border rounded-xl transition-all disabled:opacity-40 cursor-pointer ${
                  isDark
                    ? 'text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] hover:border-white/[0.12]'
                    : 'text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200 hover:border-gray-300'
                }`}
                title="Refresh (R)"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? 'spin-anim' : 'transition-transform hover:rotate-180 duration-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>

              {/* Export Buttons – only CSV & Excel */}
              <div className="hidden sm:flex items-center gap-1">
                <button onClick={exportToCSV} className={`h-9 px-3 flex items-center gap-1 text-[13px] border rounded-xl transition-all cursor-pointer ${
                  isDark ? 'text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06]'
                         : 'text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200'
                }`} title="Export CSV">
                  <span>CSV</span>
                </button>
                <button onClick={exportToExcel} className={`h-9 px-3 flex items-center gap-1 text-[13px] border rounded-xl transition-all cursor-pointer ${
                  isDark ? 'text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06]'
                         : 'text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-200'
                }`} title="Export Excel">
                  <span>Excel</span>
                </button>
              </div>

              <button
                onClick={handleAdd}
                className={`h-9 px-4 sm:px-5 flex items-center gap-2 text-[13px] font-semibold rounded-xl hover:brightness-110 transition-all active:scale-[0.97] cursor-pointer ${
                  isDark
                    ? 'text-zinc-950 bg-gradient-to-r from-teal-400 to-emerald-500 hover:shadow-lg hover:shadow-teal-500/20'
                    : 'text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Item</span>
              </button>
            </div>
          </div>
          {/* Accent line */}
          <div className={`h-[1px] bg-gradient-to-r from-transparent to-transparent transition-colors duration-500 ${
            isDark ? 'via-teal-500/30' : 'via-blue-500/20'
          }`} />
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

          {/* ═══ WARNING BANNER – NOW SHOWS BOTH EXPIRED & EXPIRING ═══ */}
          {(expiringCount > 0 || expiredCount > 0) && !dismissedWarning && (
            <div className={`anim-up mb-6 border rounded-2xl px-5 py-3.5 flex items-center gap-3 group transition-colors duration-500 ${
              expiredCount > 0
                ? (isDark ? 'bg-rose-500/[0.07] border-rose-500/15' : 'bg-red-50 border-red-200')
                : (isDark ? 'bg-amber-500/[0.07] border-amber-500/15' : 'bg-amber-50 border-amber-200')
            }`}>
              <div className="relative flex-shrink-0">
                <div className={`absolute inset-0 rounded-full pulse-ring ${
                  expiredCount > 0
                    ? (isDark ? 'bg-rose-400/30' : 'bg-red-400/40')
                    : (isDark ? 'bg-amber-400/30' : 'bg-amber-400/40')
                }`} />
                <svg className={`relative w-5 h-5 ${expiredCount > 0 ? 'text-rose-500' : 'text-amber-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {expiredCount > 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  )}
                </svg>
              </div>

              <p className={`text-sm flex-1 ${
                expiredCount > 0
                  ? (isDark ? 'text-rose-300/80' : 'text-red-700')
                  : (isDark ? 'text-amber-300/80' : 'text-amber-700')
              }`}>
                {expiredCount > 0 && (
                  <span className={`font-semibold ${isDark ? 'text-rose-200' : 'text-red-900'}`}>
                    {expiredCount} item{expiredCount !== 1 ? 's' : ''} expired
                  </span>
                )}
                {expiredCount > 0 && expiringCount > 0 && ' — '}
                {expiringCount > 0 && (
                  <span className={`font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                    {expiringCount} item{expiringCount !== 1 ? 's' : ''} expiring soon
                  </span>
                )}
                {' – review and take action.'}
              </p>

              <button
                onClick={() => setDismissedWarning(true)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                  expiredCount > 0
                    ? (isDark ? 'text-rose-500/50 hover:text-rose-300 hover:bg-rose-500/10' : 'text-red-400 hover:text-red-600 hover:bg-red-100')
                    : (isDark ? 'text-amber-500/50 hover:text-amber-300 hover:bg-amber-500/10' : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100')
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* ═══ STATS ROW + HEALTH RING ═══ */}
          <div className="flex flex-col lg:flex-row gap-5 mb-8">
            {/* Stat Cards */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="anim-up" style={{ animationDelay: '0ms' }}>
                <StatCard
                  icon={
                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  label="Active"
                  count={activeCount}
                  accentBg="bg-emerald-500/15"
                  gradientFrom={isDark ? "from-emerald-500/50" : "from-emerald-400/30"}
                  glowColor="bg-emerald-500"
                  textColor={isDark ? "text-emerald-400" : "text-emerald-600"}
                  isDark={isDark}
                />
              </div>
              <div className="anim-up" style={{ animationDelay: '90ms' }}>
                <StatCard
                  icon={
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  label="Expiring Soon"
                  count={expiringCount}
                  accentBg="bg-amber-500/15"
                  gradientFrom={isDark ? "from-amber-500/50" : "from-amber-400/30"}
                  glowColor="bg-amber-500"
                  textColor={isDark ? "text-amber-400" : "text-amber-600"}
                  isDark={isDark}
                />
              </div>
              <div className="anim-up" style={{ animationDelay: '180ms' }}>
                <StatCard
                  icon={
                    <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  label="Expired"
                  count={expiredCount}
                  accentBg="bg-rose-500/15"
                  gradientFrom={isDark ? "from-rose-500/50" : "from-rose-400/30"}
                  glowColor="bg-rose-500"
                  textColor={isDark ? "text-rose-400" : "text-rose-600"}
                  isDark={isDark}
                />
              </div>
            </div>

            {/* Health Ring Panel */}
            <div className="anim-up lg:w-52 flex-shrink-0" style={{ animationDelay: '270ms' }}>
              <div className={`h-full rounded-2xl p-5 flex flex-col items-center justify-center gap-3 transition-all duration-500 ${
                isDark
                  ? 'bg-white/[0.025] border border-white/[0.06]'
                  : 'bg-white border border-gray-200/80 shadow-sm shadow-gray-100'
              }`}>
                <HealthRing percentage={healthPercent} isDark={isDark} />
                <div className="text-center -mt-1">
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors duration-500 ${
                    isDark ? 'text-gray-600' : 'text-gray-400'
                  }`}>Total Items</p>
                  <p className={`text-2xl font-black tabular-nums leading-tight mt-0.5 transition-colors duration-500 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>{items.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ FILTER BAR ═══ */}
          <div className={`anim-up mb-6 rounded-2xl p-3.5 sm:p-4 transition-all duration-500 ${
            isDark
              ? 'bg-white/[0.025] border border-white/[0.06]'
              : 'bg-white border border-gray-200/80 shadow-sm shadow-gray-100'
          }`} style={{ animationDelay: '340ms' }}>
            <div className="flex flex-col xl:flex-row gap-3">

              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-500 ${
                  isDark ? 'text-gray-600' : 'text-gray-400'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search items..."
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm transition-all duration-500 ${
                    isDark
                      ? 'bg-white/[0.04] border-white/[0.07] text-gray-200 placeholder-gray-600 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
                  } focus:outline-none`}
                />
                {searchTerm && (
                  <button
                    onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                      isDark
                        ? 'text-gray-600 hover:text-gray-300 hover:bg-white/10'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {filters.map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`relative px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      statusFilter === key
                        ? isDark
                          ? 'bg-teal-500/15 text-teal-300 border border-teal-500/25 shadow-sm shadow-teal-500/10'
                          : 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm shadow-blue-500/5'
                        : isDark
                          ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
                          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {label}
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md ${
                      statusFilter === key
                        ? isDark
                          ? 'bg-teal-500/20 text-teal-300'
                          : 'bg-blue-100 text-blue-600'
                        : isDark
                          ? 'bg-white/[0.05] text-gray-600'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className={`hidden xl:block w-px h-9 self-center transition-colors duration-500 ${
                isDark ? 'bg-white/[0.06]' : 'bg-gray-200'
              }`} />

              {/* Sort Controls */}
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] uppercase tracking-widest font-semibold hidden xl:block mr-1 transition-colors duration-500 ${
                  isDark ? 'text-gray-600' : 'text-gray-400'
                }`}>Sort</span>
                <button
                  onClick={() => handleSortField('endDate')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    sortBy === 'endDate'
                      ? isDark
                        ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                        : 'bg-gray-100 text-gray-900 border border-gray-200'
                      : isDark
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date
                  {sortBy === 'endDate' && (
                    <svg className={`w-3 h-3 transition-transform duration-300 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleSortField('name')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    sortBy === 'name'
                      ? isDark
                        ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                        : 'bg-gray-100 text-gray-900 border border-gray-200'
                      : isDark
                        ? 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] border border-transparent'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Name
                  {sortBy === 'name' && (
                    <svg className={`w-3 h-3 transition-transform duration-300 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isDark
                      ? 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/15'
                      : 'text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ═══ RESULTS HEADER ═══ */}
          <div className="flex items-center justify-between mb-3 px-1 anim-up" style={{ animationDelay: '400ms' }}>
            <p className={`text-xs transition-colors duration-500 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Showing{' '}
              <span className={`font-semibold tabular-nums ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{filteredAndSortedItems.length}</span>
              {' '}of{' '}
              <span className={`tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{items.length}</span>
              {' '}items
            </p>
            {hasActiveFilters && (
              <span className={`text-[10px] uppercase tracking-widest font-semibold transition-colors duration-500 ${
                isDark ? 'text-teal-500/60' : 'text-blue-500/60'
              }`}>Filtered</span>
            )}
          </div>

          {/* ═══ ITEM LIST ═══ */}
          <div className={`anim-up rounded-2xl overflow-hidden custom-scroll transition-all duration-500 ${
            isDark
              ? 'bg-white/[0.02] border border-white/[0.06]'
              : 'bg-white border border-gray-200/80 shadow-sm shadow-gray-100'
          }`} style={{ animationDelay: '440ms' }}>
            {isRefreshing && items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 gap-4">
                <div className="relative w-10 h-10">
                  <div className={`absolute inset-0 rounded-full border-2 transition-colors duration-500 ${
                    isDark ? 'border-white/[0.06]' : 'border-gray-200'
                  }`} />
                  <div className={`absolute inset-0 rounded-full border-2 border-transparent spin-anim transition-colors duration-500 ${
                    isDark ? 'border-t-teal-400' : 'border-t-blue-500'
                  }`} />
                </div>
                <span className={`text-sm transition-colors duration-500 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Loading items...</span>
              </div>
            ) : filteredAndSortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 px-4 text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-colors duration-500 ${
                  isDark
                    ? 'bg-white/[0.03] border border-white/[0.05]'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  <svg className={`w-7 h-7 transition-colors duration-500 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className={`font-semibold text-base mb-1 transition-colors duration-500 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {hasActiveFilters ? 'No matching items' : 'No items yet'}
                </p>
                <p className={`text-sm max-w-xs mb-6 leading-relaxed transition-colors duration-500 ${
                  isDark ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {hasActiveFilters
                    ? 'Try adjusting your search terms or filter criteria.'
                    : 'Create your first item to start tracking inventory.'}
                </p>
                {!hasActiveFilters && (
                  <button
                    onClick={handleAdd}
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                      isDark
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/30'
                        : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                    }`}
                  >
                    + Create First Item
                  </button>
                )}
              </div>
            ) : (
              <ItemList items={filteredAndSortedItems} onEdit={handleEdit} onRefresh={fetchItems} />
            )}
          </div>

          {/* ═══ FOOTER HINTS ═══ */}
          <footer className={`mt-8 pb-4 text-center flex items-center justify-center gap-4 text-[11px] flex-wrap transition-colors duration-500 ${
            isDark ? 'text-gray-700' : 'text-gray-300'
          }`}>
            <span>
              <kbd className={`px-1.5 py-0.5 rounded-md border font-mono text-[10px] mx-0.5 transition-colors duration-500 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.07] text-gray-500'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>Ctrl+K</kbd>
              Search
            </span>
            <span className={isDark ? 'text-white/[0.06]' : 'text-gray-200'}>|</span>
            <span>
              <kbd className={`px-1.5 py-0.5 rounded-md border font-mono text-[10px] mx-0.5 transition-colors duration-500 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.07] text-gray-500'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>R</kbd>
              Refresh
            </span>
            <span className={isDark ? 'text-white/[0.06]' : 'text-gray-200'}>|</span>
            <span>
              <kbd className={`px-1.5 py-0.5 rounded-md border font-mono text-[10px] mx-0.5 transition-colors duration-500 ${
                isDark
                  ? 'bg-white/[0.04] border-white/[0.07] text-gray-500'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}>Esc</kbd>
              Close modal
            </span>
          </footer>
        </main>
      </div>

      {/* ═══════════════════════════════════════
         MODAL
         ═══════════════════════════════════════ */}
      {showForm && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            modalOpen ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none pointer-events-none'
          }`}
          onClick={(e) => e.target === e.currentTarget && handleFormClose()}
        >
          <div
            className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl custom-scroll transition-all duration-300 ${
              modalOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.95] translate-y-4'
            } ${
              isDark
                ? 'bg-zinc-900 border-white/[0.08] shadow-black/70'
                : 'bg-white border-gray-200 shadow-gray-200/50'
            }`}
          >
            {/* Modal ambient glow */}
            <div className={`absolute -top-20 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full blur-[80px] pointer-events-none transition-colors duration-500 ${
              isDark ? 'bg-teal-500/[0.08]' : 'bg-blue-500/[0.06]'
            }`} />

            <div className="relative p-6 sm:p-8">
              {/* Modal Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className={`text-lg font-bold transition-colors duration-500 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {editItem ? 'Edit Item' : 'New Item'}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {editItem ? 'Update the details below.' : 'Fill in the information to create a new item.'}
                  </p>
                </div>
                <button
                  onClick={handleFormClose}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all cursor-pointer flex-shrink-0 -mr-1 -mt-1 ${
                    isDark
                      ? 'bg-white/[0.04] hover:bg-white/[0.08] text-gray-500 hover:text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <ItemForm existingItem={editItem} onSave={handleFormSaved} onCancel={handleFormClose} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}