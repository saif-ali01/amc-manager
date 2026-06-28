import { useState, useEffect, useCallback, useRef } from 'react';
import API from '../services/api';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════
   Themed Mini-Modal
   ═══════════════════════════════════════════ */
function AddModal({ isOpen, title, onClose, onSave }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [vis, setVis] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVis(true));
      setTimeout(() => ref.current?.focus(), 100);
    } else {
      setVis(false);
      setName('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    const t = name.trim();
    if (!t) return;
    setBusy(true);
    try {
      await onSave(t);
      setName('');
      setVis(false);
      setTimeout(onClose, 200);
    } catch {
      toast.error('Failed to add');
    } finally {
      setBusy(false);
    }
  };

  const close = () => { setVis(false); setTimeout(onClose, 200); };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${
        vis ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none pointer-events-none'
      }`}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl border shadow-2xl transition-all duration-300 ${
          vis ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.92] translate-y-3'
        } ${
          isDark
            ? 'bg-zinc-900 border-white/[0.08] shadow-black/60'
            : 'bg-white border-gray-200 shadow-gray-300/40'
        }`}
      >
        <div className={`absolute -top-14 left-1/2 -translate-x-1/2 w-36 h-36 rounded-full blur-[60px] pointer-events-none ${
          isDark ? 'bg-teal-500/[0.08]' : 'bg-blue-500/[0.06]'
        }`} />

        <div className="relative p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
            <button
              onClick={close}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                isDark ? 'text-gray-500 hover:text-white hover:bg-white/[0.06]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <input
            ref={ref}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name..."
            className={`w-full rounded-xl px-4 py-2.5 text-sm transition-all duration-200 focus:outline-none ${
              isDark
                ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
                : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
            }`}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') close(); }}
          />

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={close}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !name.trim()}
              className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-teal-500 text-zinc-950 hover:bg-teal-400 shadow-lg shadow-teal-500/20'
                  : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
              }`}
            >
              {busy ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Style Hook
   ═══════════════════════════════════════════ */
function useStyles() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return {
    isDark,
    label: `block text-xs font-semibold uppercase tracking-[0.12em] mb-1.5 transition-colors duration-500 ${
      isDark ? 'text-gray-300' : 'text-gray-600'
    }`,
    required: 'text-rose-500 ml-0.5',
    input: `w-full rounded-xl px-4 py-2.5 text-sm transition-all duration-200 focus:outline-none ${
      isDark
        ? 'bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-500 focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
        : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
    }`,
    select: `w-full rounded-xl px-4 py-2.5 text-sm transition-all duration-200 appearance-none focus:outline-none cursor-pointer pr-9 ${
      isDark
        ? 'bg-white/[0.04] border border-white/[0.08] text-white focus:border-teal-500/40 focus:ring-2 focus:ring-teal-500/10'
        : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10'
    }`,
    chevron: isDark ? 'text-gray-500' : 'text-gray-400',
    addBtn: `flex-shrink-0 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
      isDark
        ? 'bg-white/[0.04] border border-white/[0.06] text-gray-300 hover:text-teal-300 hover:bg-teal-500/10 hover:border-teal-500/20'
        : 'bg-gray-100 border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200'
    }`,
    removeBtn: `flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-sm transition-all cursor-pointer ${
      isDark
        ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10'
        : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
    }`,
    dividerLine: isDark ? 'bg-white/[0.05]' : 'bg-gray-200',
    dividerText: `text-[10px] font-semibold uppercase tracking-[0.2em] ${
      isDark ? 'text-gray-500' : 'text-gray-400'
    }`,
    subLabel: `text-[10px] uppercase tracking-widest font-medium ${
      isDark ? 'text-gray-500' : 'text-gray-400'
    }`,
    addReminderBtn: `mt-2.5 flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer rounded-lg px-3 py-2 ${
      isDark ? 'text-teal-400 hover:bg-teal-500/10' : 'text-blue-600 hover:bg-blue-50'
    }`,
    cancelBtn: `px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
      isDark
        ? 'text-gray-300 border-white/[0.08] hover:text-white hover:bg-white/[0.06]'
        : 'text-gray-600 border-gray-200 hover:text-gray-800 hover:bg-gray-50'
    }`,
    submitBtn: `px-6 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
      isDark
        ? 'bg-gradient-to-r from-teal-400 to-emerald-500 text-zinc-950 hover:shadow-lg hover:shadow-teal-500/20 hover:brightness-110'
        : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:brightness-110'
    }`,
    prefix: `absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold transition-colors duration-500 ${
      isDark ? 'text-gray-400' : 'text-gray-500'
    }`,
    inputIcon: `absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors duration-500 ${
      isDark ? 'text-gray-500' : 'text-gray-400'
    }`,
  };
}

/* ═══════════════════════════════════════════
   Divider
   ═══════════════════════════════════════════ */
function Divider({ label, s }) {
  return (
    <div className="flex items-center gap-3 pt-1 pb-2">
      <div className={`flex-1 h-px transition-colors duration-500 ${s.dividerLine}`} />
      <span className={`transition-colors duration-500 ${s.dividerText}`}>{label}</span>
      <div className={`flex-1 h-px transition-colors duration-500 ${s.dividerLine}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   SelectField – unchanged
   ═══════════════════════════════════════════ */
function SelectField({ label, name, value, options, onChange, onAdd, required, s }) {
  return (
    <div>
      <label className={s.label}>
        {label}{required && <span className={s.required}>*</span>}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <select
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            className={s.select}
            style={{ colorScheme: s.isDark ? 'dark' : 'light' }}
          >
            <option value="">-- Select --</option>
            {options.map((item) => (
              <option key={item._id} value={item._id}>{item.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className={`w-4 h-4 transition-colors duration-500 ${s.chevron}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <button type="button" onClick={onAdd} className={s.addBtn}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main ItemForm
   ═══════════════════════════════════════════ */
export default function ItemForm({ existingItem, onSave, onCancel }) {
  const s = useStyles();

  // ✅ Helper to safely extract the ID from a possibly populated field
  const getFieldId = (field) => {
    if (!existingItem) return '';
    const data = existingItem[field];
    if (!data) return '';
    // populated object (most common)
    if (typeof data === 'object' && data._id) return data._id;
    // plain string (fallback for old / unpopulated data)
    if (typeof data === 'string') return data;
    return '';
  };

  // ✅ Form state – now uses correct IDs
  const [form, setForm] = useState({
    name: existingItem?.name || '',
    type: getFieldId('type'),
    provider: getFieldId('provider'),
    company: getFieldId('company'),
    location: getFieldId('location'),
    startDate: existingItem?.startDate
      ? new Date(existingItem.startDate).toISOString().split('T')[0]
      : '',
    endDate: existingItem?.endDate
      ? new Date(existingItem.endDate).toISOString().split('T')[0]
      : '',
    cost: existingItem?.cost || '',
    notes: existingItem?.notes || '',
    reminders: existingItem?.reminders?.map((r) => r.daysBefore) || [30, 15, 7],
  });

  const [userTypes, setUserTypes] = useState([]);
  const [userVendors, setUserVendors] = useState([]);
  const [userCompanies, setUserCompanies] = useState([]);
  const [userLocations, setUserLocations] = useState([]);

  const [typeModal, setTypeModal] = useState(false);
  const [vendorModal, setVendorModal] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [locationModal, setLocationModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    API.get('/types').then((r) => setUserTypes(r.data)).catch(console.error);
    API.get('/vendors').then((r) => setUserVendors(r.data)).catch(console.error);
    API.get('/companies').then((r) => setUserCompanies(r.data)).catch(console.error);
    API.get('/locations').then((r) => setUserLocations(r.data)).catch(console.error);
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleReminderChange = (i, v) => {
    const next = [...form.reminders];
    next[i] = v === '' ? '' : Number(v);
    setForm({ ...form, reminders: next });
  };
  const addReminder = () => setForm({ ...form, reminders: [...form.reminders, ''] });
  const removeReminder = (i) => {
    if (form.reminders.length <= 1) return;
    setForm({ ...form, reminders: form.reminders.filter((_, idx) => idx !== i) });
  };

  const addType = useCallback(async (name) => {
    const res = await API.post('/types', { name });
    setUserTypes((p) => [...p, res.data]);
    setForm((p) => ({ ...p, type: res.data._id }));
    toast.success('Type added');
  }, []);

  const addVendor = useCallback(async (name) => {
    const res = await API.post('/vendors', { name });
    setUserVendors((p) => [...p, res.data]);
    setForm((p) => ({ ...p, provider: res.data._id }));
    toast.success('Vendor added');
  }, []);

  const addCompany = useCallback(async (name) => {
    const res = await API.post('/companies', { name });
    setUserCompanies((p) => [...p, res.data]);
    setForm((p) => ({ ...p, company: res.data._id }));
    toast.success('Company added');
  }, []);

  const addLocation = useCallback(async (name) => {
    const res = await API.post('/locations', { name });
    setUserLocations((p) => [...p, res.data]);
    setForm((p) => ({ ...p, location: res.data._id }));
    toast.success('Location added');
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        reminders: form.reminders
          .filter((r) => r !== '' && !isNaN(r))
          .map((days) => ({ daysBefore: Number(days) })),
        cost: form.cost ? Number(form.cost) : undefined,
        company: form.company || null,
        location: form.location || null,
      };
      if (existingItem) {
        await API.put(`/items/${existingItem._id}`, payload);
        toast.success('Item updated successfully');
      } else {
        await API.post('/items', payload);
        toast.success('Item created successfully');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      <Divider label="Item Details" s={s} />

      <div>
        <label className={s.label}>
          Name <span className={s.required}>*</span>
        </label>
        <input
          type="text" name="name" value={form.name}
          onChange={handleChange} required
          placeholder="e.g., Firewall License"
          className={s.input}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Type" name="type" value={form.type}
          options={userTypes} onChange={handleChange}
          onAdd={() => setTypeModal(true)} required s={s}
        />
        <SelectField
          label="Vendor" name="provider" value={form.provider}
          options={userVendors} onChange={handleChange}
          onAdd={() => setVendorModal(true)} s={s}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Company" name="company" value={form.company}
          options={userCompanies} onChange={handleChange}
          onAdd={() => setCompanyModal(true)} s={s}
        />
        <SelectField
          label="Location" name="location" value={form.location}
          options={userLocations} onChange={handleChange}
          onAdd={() => setLocationModal(true)} s={s}
        />
      </div>

      <Divider label="Schedule & Cost" s={s} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label className={s.label}>
            Start Date <span className={s.required}>*</span>
          </label>
          <input
            type="date" name="startDate" value={form.startDate}
            onChange={handleChange} required
            style={{ colorScheme: s.isDark ? 'dark' : 'light' }}
            className={s.input}
          />
        </div>
        <div>
          <label className={s.label}>
            End Date <span className={s.required}>*</span>
          </label>
          <input
            type="date" name="endDate" value={form.endDate}
            onChange={handleChange} required
            style={{ colorScheme: s.isDark ? 'dark' : 'light' }}
            className={s.input}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={s.label}>Cost</label>
          <div className="relative">
            <span className={s.prefix}>₹</span>
            <input
              type="number" name="cost" value={form.cost}
              onChange={handleChange} placeholder="0" min="0"
              className={`${s.input} pl-8`}
            />
          </div>
        </div>
      </div>

      <Divider label="Notes" s={s} />

      <div>
        <textarea
          name="notes" value={form.notes}
          onChange={handleChange} rows="3"
          placeholder="Add any additional details..."
          className={`${s.input} resize-none`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className={s.label} style={{ marginBottom: 0 }}>Reminders</label>
          <span className={s.subLabel}>days before expiry</span>
        </div>

        <div className="space-y-2">
          {form.reminders.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg className={s.inputIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <input
                  type="number" value={r}
                  onChange={(e) => handleReminderChange(i, e.target.value)}
                  placeholder="e.g., 30" min="0"
                  className={`${s.input} pl-10`}
                />
              </div>
              <button
                type="button" onClick={() => removeReminder(i)}
                className={s.removeBtn} title="Remove"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addReminder} className={s.addReminderBtn}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add reminder
        </button>
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 pb-1">
        <button type="button" onClick={onCancel} className={s.cancelBtn}>
          Cancel
        </button>
        <button type="submit" disabled={submitting} className={s.submitBtn}>
          {submitting && (
            <svg className="w-3.5 h-3.5 spin-anim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {submitting ? 'Saving...' : existingItem ? 'Update Item' : 'Create Item'}
        </button>
      </div>

      <AddModal isOpen={typeModal} title="Add New Type" onClose={() => setTypeModal(false)} onSave={addType} />
      <AddModal isOpen={vendorModal} title="Add New Vendor" onClose={() => setVendorModal(false)} onSave={addVendor} />
      <AddModal isOpen={companyModal} title="Add New Company" onClose={() => setCompanyModal(false)} onSave={addCompany} />
      <AddModal isOpen={locationModal} title="Add New Location" onClose={() => setLocationModal(false)} onSave={addLocation} />
    </form>
  );
}