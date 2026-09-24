import { LogOut, Mail, Sun, Moon } from 'lucide-react';
import type { User } from '../types/user';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  const displayName = user?.name || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="brand-icon-circle">
            <Mail size={20} strokeWidth={2.2} />
          </div>
          <span className="brand-name">
            Reach<span>Inbox</span>
          </span>
        </div>

        <div className="header-user">
          <div className="hidden sm:flex items-center gap-2">
            <span className="tech-pill">
              <span className="status-dot-amber" />
              DEV PREVIEW
            </span>
            <span className="tech-pill">
              ENGINE: SIMULATION
            </span>
          </div>

          <button
            onClick={toggleTheme}
            className="sun-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className="avatar-wrapper">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="avatar-img" />
            ) : (
              <div className="avatar-fallback">{initials}</div>
            )}
          </div>

          <div className="user-info">
            <span className="user-name">{displayName}</span>
            <span className="user-email">{user?.email || ''}</span>
          </div>

          <button onClick={onLogout} className="btn-logout" title="Sign Out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
