import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ToastContainer from './components/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { getCurrentUser, devLogin, logout } from './lib/api';
import type { User } from './types/user';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');
        if (tokenFromUrl) {
          localStorage.setItem('auth_token', tokenFromUrl);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  async function handleDevLogin() {
    try {
      const devUser = await devLogin();
      setUser(devUser);
    } catch (err) {
      console.error('Development login failed:', err);
    }
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return (
      <ThemeProvider>
        <div className="app-background min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs tracking-wider uppercase text-zinc-400">Loading ReachInbox...</span>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      {user ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <Login onDevLogin={handleDevLogin} />
      )}
      <ToastContainer />
    </ThemeProvider>
  );
}
