import { useState, useEffect } from 'react';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [tab, setTab] = useState('profile');

  useEffect(() => {
    API.get('/notification-emails')
      .then((res) => setEmails(res.data))
      .catch(console.error);
  }, []);

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

      // Update context and localStorage immediately
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

  /* ── Styles (unchanged) ── */
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

      <div className="flex gap-2 mb-8">
        <button onClick={() => setTab('profile')} className={tabButton('profile')}>Profile</button>
        <button onClick={() => setTab('notifications')} className={tabButton('notifications')}>Notification Emails</button>
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
    </div>
  );
}