// ─── App.jsx ───
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';

/* ── Spinner ── */
function Spinner({ size = 40, stroke = 2.5 }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border-2 border-current opacity-10" />
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderTopColor: 'currentColor',
          animationDuration: '0.7s',
        }}
      />
    </div>
  );
}

/* ── Loading Screen ── */
function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-gray-50 transition-colors duration-500"
      data-theme="light"
    >
      <div className="text-gray-900">
        <Spinner size={44} />
      </div>
      <p className="text-sm font-medium text-gray-400 tracking-wide animate-pulse">
        Authenticating...
      </p>
    </div>
  );
}

/* ── Route Guard ── */
function PrivateRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return token ? children : <Navigate to="/login" replace />;
}

/* ── Inner App (has access to theme) ── */
function AppShell() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${
        isDark ? 'bg-[#08080c]' : 'bg-gray-50'
      }`}
    >
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

/* ── Root App ── */
export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}