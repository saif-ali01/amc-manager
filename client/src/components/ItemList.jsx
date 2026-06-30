import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import API from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { Edit2, Trash2, Eye, Calendar, MapPin, X } from 'lucide-react';

// Dynamic "Expiring" threshold — largest daysBefore configured on the item's
// own reminders, falling back to 30 if none are set.
function getExpiringThreshold(item) {
  if (!item.reminders || item.reminders.length === 0) return 30;
  const days = item.reminders.map(r => r.daysBefore).filter(d => typeof d === 'number');
  return days.length ? Math.max(...days) : 30;
}

function getDiffDays(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function calculateValue(item) {
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  const now = new Date();
  const cost = item.cost || 0;
  const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  let daysElapsed = Math.ceil((now - start) / (1000 * 60 * 60 * 24));
  daysElapsed = Math.min(Math.max(daysElapsed, 0), totalDays);
  const daysRemaining = totalDays - daysElapsed;

  if (item.billingType === 'postpaid') {
    const accruedValue = Math.round((cost * daysElapsed) / totalDays);
    return { billingType: 'postpaid', accruedValue, remainingValue: cost - accruedValue, daysElapsed, daysRemaining, totalDays };
  }
  const remainingValue = Math.round((cost * daysRemaining) / totalDays);
  return { billingType: 'prepaid', usedValue: cost - remainingValue, remainingValue, daysElapsed, daysRemaining, totalDays };
}

export default function ItemList({ items, onEdit, onRefresh }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedItem) setSelectedItem(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItem]);

  // Clear selection if the underlying items list changes
  useEffect(() => {
    setSelectedIds(prev => {
      const validIds = new Set(items.map(i => i._id));
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === items.length ? new Set() : new Set(items.map(i => i._id))
    );
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;
    try {
      await API.delete(`/items/${id}`);
      toast.success('Item deleted successfully');
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected item(s)? This action cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const res = await API.delete('/items/bulk', { data: { ids: [...selectedIds] } });
      toast.success(res.data?.message || `Deleted ${selectedIds.size} item(s)`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err) {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  // ─── CORRECTED status badge with grace period for postpaid ──
  const getStatusBadge = (item) => {
    const end = new Date(item.endDate);
    const now = new Date();
    const diffDays = getDiffDays(item.endDate);
    const threshold = getExpiringThreshold(item);

    // Grace period for postpaid (30 days after endDate)
    const graceDays = item.billingType === 'postpaid' ? 30 : 0;
    const expiredDate = new Date(end);
    expiredDate.setDate(expiredDate.getDate() + graceDays);

    // 1. Check if completely expired (past grace period)
    if (expiredDate < now) {
      return (
        <span className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-300 ${
          isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-red-100 text-red-700'
        }`}>
          Expired
        </span>
      );
    }

    // 2. Check if still before the original end date and within threshold
    if (now < end && diffDays <= threshold) {
      return (
        <span className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-300 ${
          isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
        }`}>
          Expiring in {diffDays}d
        </span>
      );
    }

    // 3. Otherwise Active
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-300 ${
        isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
      }`}>
        Active
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return amount || amount === 0 ? `₹${amount.toLocaleString('en-IN')}` : '—';
  };

  /* ════════════════════════════════════════
     Shared Styles (unchanged)
     ════════════════════════════════════════ */
  const tableWrapper = `hidden md:block rounded-2xl overflow-hidden border transition-colors duration-500 ${
    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200/80 shadow-sm'
  }`;

  const thStyle = `px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors duration-500 ${
    isDark ? 'text-gray-500' : 'text-gray-500'
  }`;

  const tdPrimary = `font-medium transition-colors duration-500 ${
    isDark ? 'text-white' : 'text-gray-900'
  }`;

  const tdSecondary = `transition-colors duration-500 ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;

  const rowHover = `transition-colors duration-150 cursor-pointer ${
    isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50/80'
  }`;

  const divideStyle = isDark ? 'divide-white/[0.04]' : 'divide-gray-100';
  const theadBg = isDark ? 'bg-white/[0.02]' : 'bg-gray-50/80';

  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const checkboxCls = `w-4 h-4 rounded cursor-pointer accent-current ${
    isDark ? 'text-teal-400' : 'text-blue-600'
  }`;

  return (
    <div className="space-y-6 relative">

      {/* ═══ Bulk Delete Bar ═══ */}
      {selectedIds.size > 0 && (
        <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-colors duration-300 ${
          isDark ? 'bg-rose-500/[0.07] border-rose-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <span className={`text-sm font-medium ${isDark ? 'text-rose-200' : 'text-red-800'}`}>
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                isDark ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Desktop Table View ═══ */}
      <div className={tableWrapper}>
        <table className="min-w-full divide-y divide-transparent">
          <thead className={theadBg}>
            <tr>
              <th className={`${thStyle} w-10`}>
                <input
                  type="checkbox"
                  className={checkboxCls}
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className={thStyle}>Item Name</th>
              <th className={thStyle}>Type</th>
              <th className={thStyle}>Provider</th>
              <th className={thStyle}>Location</th>
              <th className={thStyle}>Validity</th>
              <th className={thStyle}>Cost</th>
              <th className={thStyle}>Status</th>
              <th className={`${thStyle} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${divideStyle}`}>
            {items.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-20 text-center">
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No items to display</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item._id}
                  className={`${rowHover} ${selectedIds.has(item._id) ? (isDark ? 'bg-white/[0.05]' : 'bg-blue-50/60') : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={checkboxCls}
                      checked={selectedIds.has(item._id)}
                      onChange={() => toggleSelect(item._id)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className={tdPrimary}>{item.name}</div>
                    <div className={`text-[10px] uppercase tracking-wider mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {item.billingType || 'prepaid'}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm ${tdSecondary}`}>
                    {item.type?.name || '—'}
                  </td>
                  <td className={`px-6 py-4 text-sm ${tdSecondary}`}>
                    {item.provider?.name || '—'}
                  </td>
                  <td className="px-6 py-4">
                    {item.location?.name ? (
                      <div className={`flex items-center gap-1.5 text-sm ${tdSecondary}`}>
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {item.location.name}
                      </div>
                    ) : (
                      <span className={tdSecondary}>—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 text-sm ${tdSecondary}`}>
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="whitespace-nowrap">
                        {new Date(item.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} → {new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm whitespace-nowrap ${tdPrimary}`}>
                    {formatCurrency(item.cost)}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(item)}</td>

                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                          isDark ? 'text-gray-500 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(item)}
                        className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                          isDark ? 'text-teal-400/70 hover:text-teal-300 hover:bg-teal-500/10' : 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
                        }`}
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                          isDark ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ Mobile Card View ═══ */}
      <div className="md:hidden space-y-4">
        {items.length === 0 ? (
          <div className={`rounded-2xl p-10 text-center border transition-colors duration-500 ${
            isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-white border-gray-200'
          }`}>
            <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No items yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item._id}
              className={`rounded-2xl p-5 border transition-colors duration-500 cursor-pointer ${
                selectedIds.has(item._id)
                  ? (isDark ? 'bg-white/[0.06] border-teal-500/30' : 'bg-blue-50/60 border-blue-300')
                  : (isDark ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]' : 'bg-white border-gray-200 shadow-sm hover:bg-gray-50/80')
              }`}
              onClick={() => setSelectedItem(item)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-3 pr-4">
                  <input
                    type="checkbox"
                    className={`${checkboxCls} mt-1`}
                    checked={selectedIds.has(item._id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(item._id)}
                  />
                  <div>
                    <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</h3>
                    <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {item.type?.name || '—'} · <span className="uppercase text-[10px] tracking-wider">{item.billingType || 'prepaid'}</span>
                    </p>
                  </div>
                </div>
                {getStatusBadge(item)}
              </div>

              <div className={`space-y-2.5 text-sm pb-4 mb-4 border-b ${isDark ? 'text-gray-400 border-white/[0.05]' : 'text-gray-600 border-gray-100'}`}>
                {item.provider?.name && (
                  <p><span className={isDark ? 'text-gray-600' : 'text-gray-400'}>Provider:</span> {item.provider.name}</p>
                )}
                {item.location?.name && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.location.name}</span>
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{new Date(item.startDate).toLocaleDateString('en-IN')} — {new Date(item.endDate).toLocaleDateString('en-IN')}</span>
                </p>
                <p className={isDark ? 'text-gray-300' : 'text-gray-800'}>
                  <span className={isDark ? 'text-gray-600' : 'text-gray-400'}>Cost:</span> {formatCurrency(item.cost)}
                </p>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setSelectedItem(item)}
                  className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer border ${
                    isDark
                      ? 'border-white/[0.08] text-gray-300 hover:bg-white/[0.04]'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Eye className="w-4 h-4" /> View
                </button>
                <button
                  onClick={() => onEdit(item)}
                  className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-teal-500 text-zinc-950 hover:bg-teal-400'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(item._id)}
                  className={`py-2.5 px-4 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    isDark
                      ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10'
                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══ Detail Modal (Portal) ═══ */}
      {selectedItem &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className={`rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border transition-all duration-300 ${
                isDark
                  ? 'bg-zinc-900 border-white/[0.08] text-white'
                  : 'bg-white border-gray-200 text-gray-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 sm:p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="pr-4">
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedItem.name}</h2>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {selectedItem.type?.name || '—'} · <span className="uppercase text-[10px] tracking-wider">{selectedItem.billingType || 'prepaid'}</span>
                    </p>
                  </div>
                  {getStatusBadge(selectedItem)}
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Provider</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedItem.provider?.name || 'Not Specified'}</p>
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Company</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{selectedItem.company?.name || 'Not Specified'}</p>
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Location</p>
                      <p className={`text-sm font-medium flex items-center gap-1.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        <MapPin className="w-3.5 h-3.5" />
                        {selectedItem.location?.name || 'Not Specified'}
                      </p>
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Start Date</p>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(selectedItem.startDate).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>End Date</p>
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(selectedItem.endDate).toLocaleDateString('en-IN')}</p>
                    </div>
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Total Cost</p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatCurrency(selectedItem.cost)}</p>
                    </div>
                  </div>

                  {/* ═══ Prepaid / Postpaid Value Breakdown ═══ */}
                  {(() => {
                    const v = calculateValue(selectedItem);
                    const isPostpaid = v.billingType === 'postpaid';
                    return (
                      <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-gray-50 border-gray-200'}`}>
                        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {isPostpaid ? 'Postpaid — Accrued so far' : 'Prepaid — Remaining value'}
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                              {isPostpaid ? 'Accrued' : 'Used'}
                            </p>
                            <p className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {formatCurrency(isPostpaid ? v.accruedValue : v.usedValue)}
                            </p>
                          </div>
                          <div>
                            <p className={isDark ? 'text-gray-500' : 'text-gray-500'}>
                              {isPostpaid ? 'Yet to bill' : 'Remaining'}
                            </p>
                            <p className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                              {formatCurrency(v.remainingValue)}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className={isDark ? 'text-gray-600' : 'text-gray-400'}>
                              {v.daysElapsed} of {v.totalDays} days elapsed · {v.daysRemaining}d remaining
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {selectedItem.notes && (
                    <div>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Notes</p>
                      <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                        isDark ? 'bg-white/[0.03] text-gray-300 border border-white/[0.05]' : 'bg-gray-50 text-gray-700'
                      }`}>
                        {selectedItem.notes}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => {
                      onEdit(selectedItem);
                      setSelectedItem(null);
                    }}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                      isDark
                        ? 'bg-teal-500 text-zinc-950 hover:bg-teal-400 shadow-lg shadow-teal-500/20'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                    }`}
                  >
                    Edit Item
                  </button>
                  <button
                    onClick={() => setSelectedItem(null)}
                    className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer border ${
                      isDark
                        ? 'border-white/[0.08] text-gray-300 hover:bg-white/[0.04]'
                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}