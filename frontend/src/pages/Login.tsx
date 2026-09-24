import { useEffect } from 'react';
import { Sun, Moon, Laptop, Smartphone, Sparkles } from 'lucide-react';
import { getGoogleAuthUrl } from '../lib/auth';
import BackgroundParticles from '../components/BackgroundParticles';
import { useTheme } from '../context/ThemeContext';
import { showToast } from '../components/Toast';

interface LoginProps {
  onDevLogin: () => void;
}

export default function Login({ onDevLogin }: LoginProps) {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    if (authError) {
      showToast(`Google login failed: ${authError.replace(/_/g, ' ')}`, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  function handleGoogleLogin() {
    window.location.href = getGoogleAuthUrl();
  }

  return (
    <div className="app-background">
      <BackgroundParticles />

      <header className="relative z-20 flex justify-end p-6 max-w-6xl mx-auto w-full">
        <button
          onClick={toggleTheme}
          className="sun-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-16">
        <section className="hero-wrapper">
          <div className="hero-brand-row">
            <div className="hero-circle-badge" title="Desktop Client">
              <Laptop size={26} strokeWidth={2.2} />
            </div>

            <div className="hero-title-container">
              <h1 className="hero-title">
                Reach<span className="hero-title-accent">Inbox</span>
              </h1>
              <div className="hero-underline-bar" />
            </div>

            <div className="hero-circle-badge" title="Mobile & Web">
              <Smartphone size={24} strokeWidth={2.2} />
            </div>
          </div>

          <p className="hero-tagline">
            Scheduled. Throttled. Unstoppable.
          </p>

          <p className="hero-tech-specs">
            EMAIL JOB SCHEDULER <span>|</span> DEVELOPMENT PREVIEW
          </p>
        </section>

        <section className="dual-cards-container">
          <div className="airshare-card">
            <div className="card-header-bar">
              <span className="vertical-orange-indicator" />
              <h2 className="card-heading">Google OAuth</h2>
            </div>
            <p className="card-subtitle">
              Production authentication flow. Connect your verified Google account to manage campaigns (requires active backend server).
            </p>

            <div className="mt-auto pt-2">
              <button onClick={handleGoogleLogin} className="btn-airshare-orange">
                <svg width="20" height="20" viewBox="0 0 24 24" className="mr-1">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#ffffff"
                    opacity="0.95"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#ffffff"
                    opacity="0.85"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#ffffff"
                    opacity="0.8"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#ffffff"
                    opacity="0.9"
                  />
                </svg>
                Continue with Google
              </button>
            </div>
          </div>

          <div className="airshare-card">
            <div className="card-header-bar">
              <span className="vertical-orange-indicator" />
              <h2 className="card-heading">Development Sandbox</h2>
            </div>
            <p className="card-subtitle">
              Local preview mode. Bypass authentication with typed mock data while the backend is under development.
            </p>

            <div className="mt-auto">
              <label className="input-label-airshare">MOCK ENVIRONMENT</label>
              <div className="airshare-code-box active">
                <span className="status-dot-amber" />
                LOCAL-MOCK-SANDBOX
              </div>

              <button onClick={onDevLogin} className="btn-airshare-dark">
                <Sparkles size={17} className="text-orange-500" />
                Enter Development Sandbox
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
