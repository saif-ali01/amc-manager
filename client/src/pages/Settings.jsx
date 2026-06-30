import { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ── Profile state ──
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // ── Notification emails ──
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // ── Reference Data ──
  const [types, setTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [locations, setLocations] = useState([]);

  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [selectedVendors, setSelectedVendors] = useState(new Set());
  const [selectedCompanies, setSelectedCompanies] = useState(new Set());
  const [selectedLocations, setSelectedLocations] = useState(new Set());

  const [newType, setNewType] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newLocation, setNewLocation] = useState('');

  const [addingType, setAddingType] = useState(false);
  const [addingVendor, setAddingVendor] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  const [tab, setTab] = useState('profile');
  const [refTab, setRefTab] = useState('types');

  // ── Fetch all reference data ──
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [typesRes, vendorsRes, companiesRes, locationsRes] = await Promise.all([
          API.get('/types'),
          API.get('/vendors'),
          API.get('/companies'),
          API.get('/locations'),
        ]);
        setTypes(typesRes.data);
        setVendors(vendorsRes.data);
        setCompanies(companiesRes.data);
        setLocations(locationsRes.data);
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    };
    fetchAll();
  }, []);

  // Fetch notification emails
  useEffect(() => {
    API.get('/notification-emails')
      .then((res) => setEmails(res.data))
      .catch(console.error);
  }, []);

  // ── Profile handlers ──
  const handleProfileChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const payload = {
        name: profile.name,
        email: profile.email,
      };
      if (currentPassword && newPassword) {
        payload.password = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await API.put('/auth/profile', payload);

      const updatedUser = { ...user, name: res.data.name, email: res.data.email };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setCurrentPassword('');
      setNewPassword('');
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Notification email handlers ──
  const addEmail = async () => {
    const email = newEmail.trim();
    if (!email) return;
    setEmailLoading(true);
    try {
      const res = await API.post('/notification-emails', { email });
      setEmails([...emails, res.data]);
      setNewEmail('');
      toast.success('Email added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add email');
    } finally {
      setEmailLoading(false);
    }
  };

  const removeEmail = async (id) => {
    if (!confirm('Remove this email?')) return;
    try {
      await API.delete(`/notification-emails/${id}`);
      setEmails(emails.filter((e) => e._id !== id));
      toast.success('Email removed');
    } catch (err) {
      toast.error('Failed to remove email');
    }
  };

  // ── Reference entity handlers ──
  const addEntity = async (endpoint, name, setList, setAdding, setNewName) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await API.post(endpoint, { name: trimmed });
      setList(prev => [...prev, res.data]);
      setNewName('');
      toast.success(`${endpoint.slice(1).slice(0, -1)} added`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const deleteEntity = async (endpoint, id, setList) => {
    if (!confirm('Delete this item?')) return;
    try {
      await API.delete(`${endpoint}/${id}`);
      setList(prev => prev.filter(item => item._id !== id));
      toast.success('Deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const bulkDeleteEntities = async (endpoint, selectedIds, setList, setSelected) => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected item(s)?`)) return;
    try {
      const res = await API.delete(`${endpoint}/bulk`, { data: { ids: [...selectedIds] } });
      toast.success(res.data.message || 'Deleted');
      setList(prev => prev.filter(item => !selectedIds.has(item._id)));
      setSelected(new Set());
    } catch (err) {
      toast.error('Bulk delete failed');
    }
  };

  const toggleSelect = (id, setSelected) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Render helper with "Select All" header ──
  const renderEntitySection = (
    label,
    items,
    selectedIds,
    setSelected,
    newValue,
    setNewValue,
    adding,
    addEndpoint,
    setList,
    addHandler
  ) => {
    const displayName = label.toLowerCase();
    const allSelected = items.length > 0 && items.every(item => selectedIds.has(item._id));
    const someSelected = selectedIds.size > 0 && selectedIds.size < items.length;

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Add new ${displayName}...`}
            className={inputClass}
            onKeyDown={(e) => e.key === 'Enter' && addHandler()}
          />
          <button
            onClick={addHandler}
            disabled={adding || !newValue.trim()}
            className={btnPrimary}
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>

        {selectedIds.size > 0 && (
          <div className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-rose-500/10' : 'bg-red-50'}`}>
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <button
              onClick={() => bulkDeleteEntities(addEndpoint, selectedIds, setList, setSelected)}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
            >
              Delete Selected
            </button>
          </div>
        )}

        <div className={`rounded-xl border ${isDark ? 'border-white/[0.08]' : 'border-gray-200'}`}>
          {items.length === 0 ? (
            <div className="p-6 text-center">
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No {displayName} added yet.</p>
            </div>
          ) : (
            <>
              {/* ─── "Select All" header row ─── */}
              <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-white/[0.06]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => {
                    if (allSelected) {
                      setSelected(new Set());
                    } else {
                      setSelected(new Set(items.map(item => item._id)));
                    }
                  }}
                  className={`w-4 h-4 rounded accent-current ${isDark ? 'text-teal-400' : 'text-blue-600'}`}
                />
                <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Select All
                </span>
              </div>

              <ul className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                {items.map((item) => (
                  <li key={item._id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item._id)}
                        onChange={() => toggleSelect(item._id, setSelected)}
                        className={`w-4 h-4 rounded accent-current ${isDark ? 'text-teal-400' : 'text-blue-600'}`}
                      />
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        {item.name}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteEntity(addEndpoint, item._id, setList)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-red-500 hover:bg-red-50'}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Styles ──
  const containerClass = `max-w-2xl mx-auto mt-8 p-6 sm:p-8 rounded-2xl border shadow-sm transition-colors duration-500 ${
    isDark ? 'bg-zinc-900/80 border-white/[0.08] text-white' : 'bg-white border-gray-200 text-gray-900'
  }`;
  const tabButton = (tabName) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
      tab === tabName
        ? isDark
          ? 'bg-teal-500/20 text-teal-300'
          : 'bg-blue-50 text-blue-600'
        : isDark
        ? 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
    }`;
  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-colors ${
    isDark
      ? 'bg-white/[0.05] border-white/[0.1] text-white placeholder-gray-500'
      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
  }`;
  const labelClass = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;
  const btnPrimary = `px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div className={containerClass}>
      <h2 className="text-xl font-bold mb-6">Settings</h2>

      <div className="flex flex-wrap gap-2 mb-8">
        <button onClick={() => setTab('profile')} className={tabButton('profile')}>Profile</button>
        <button onClick={() => setTab('notifications')} className={tabButton('notifications')}>Notification Emails</button>
        <button onClick={() => setTab('reference')} className={tabButton('reference')}>Reference Data</button>
      </div>

      {tab === 'profile' && (
        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Full Name</label>
            <input type="text" name="name" value={profile.name} onChange={handleProfileChange} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email address</label>
            <input type="email" name="email" value={profile.email} onChange={handleProfileChange} required className={inputClass} />
          </div>
          <hr className={`border-t ${isDark ? 'border-white/[0.08]' : 'border-gray-200'}`} />
          <div>
            <label className={labelClass}>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Leave blank to keep the same" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Optional" className={inputClass} />
            <p className={`text-[11px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Only fill both password fields if you want to change it.</p>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={profileSaving} className={btnPrimary}>{profileSaving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      )}

      {tab === 'notifications' && (
        <section>
          <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Add email addresses that will receive expiry reminders. The owner email is always included.</p>
          <div className="flex gap-2 mb-6">
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="colleague@example.com" className={inputClass} onKeyDown={(e) => e.key === 'Enter' && addEmail()} />
            <button onClick={addEmail} disabled={emailLoading || !newEmail.trim()} className={btnPrimary}>{emailLoading ? 'Adding...' : 'Add'}</button>
          </div>
          <div className={`rounded-xl border ${isDark ? 'border-white/[0.08]' : 'border-gray-200'}`}>
            {emails.length === 0 ? (
              <div className="p-6 text-center"><p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No additional emails added yet.</p></div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-white/[0.06]">
                {emails.map((entry) => (
                  <li key={entry._id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-100 text-blue-600'}`}>
                        {entry.email.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{entry.email}</span>
                    </div>
                    <button onClick={() => removeEmail(entry._id)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-red-500 hover:bg-red-50'}`}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'reference' && (
        <section>
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setRefTab('types')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                refTab === 'types'
                  ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-50 text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Types
            </button>
            <button
              onClick={() => setRefTab('vendors')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                refTab === 'vendors'
                  ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-50 text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Vendors
            </button>
            <button
              onClick={() => setRefTab('companies')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                refTab === 'companies'
                  ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-50 text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Companies
            </button>
            <button
              onClick={() => setRefTab('locations')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                refTab === 'locations'
                  ? isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-blue-50 text-blue-600'
                  : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Locations
            </button>
          </div>

          {refTab === 'types' &&
            renderEntitySection(
              'Types',
              types,
              selectedTypes,
              setSelectedTypes,
              newType,
              setNewType,
              addingType,
              '/types',
              setTypes,
              () => addEntity('/types', newType, setTypes, setAddingType, setNewType)
            )}
          {refTab === 'vendors' &&
            renderEntitySection(
              'Vendors',
              vendors,
              selectedVendors,
              setSelectedVendors,
              newVendor,
              setNewVendor,
              addingVendor,
              '/vendors',
              setVendors,
              () => addEntity('/vendors', newVendor, setVendors, setAddingVendor, setNewVendor)
            )}
          {refTab === 'companies' &&
            renderEntitySection(
              'Companies',
              companies,
              selectedCompanies,
              setSelectedCompanies,
              newCompany,
              setNewCompany,
              addingCompany,
              '/companies',
              setCompanies,
              () => addEntity('/companies', newCompany, setCompanies, setAddingCompany, setNewCompany)
            )}
          {refTab === 'locations' &&
            renderEntitySection(
              'Locations',
              locations,
              selectedLocations,
              setSelectedLocations,
              newLocation,
              setNewLocation,
              addingLocation,
              '/locations',
              setLocations,
              () => addEntity('/locations', newLocation, setLocations, setAddingLocation, setNewLocation)
            )}
        </section>
      )}
    </div>
  );
}