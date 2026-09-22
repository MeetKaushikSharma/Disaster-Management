import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { login } from '../api/services';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      setAuth(data.token, data.admin);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="card-decoration card-decoration-top" aria-hidden="true" />
        <div className="card-decoration card-decoration-bottom" aria-hidden="true" />

        <div className="login-content">
          <div className="login-brand-wrap">
            <img src="/RakṣāSetu.png" alt="RakṣāSetu" className="login-brand-logo" width="120" />
          </div>

          <div className="login-header">
            <h2>COMMAND CENTER</h2>
            <h3>Administrator Login</h3>
            <p>Secure access to the disaster management dashboard.</p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">OFFICIAL EMAIL</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your official email"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">PASSWORD</label>
              <div className="input-with-icon input-with-icon--password">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <span className="forgot-password">Forgot password?</span>
            </div>

            <button
              type="submit"
              id="btn-login"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <LogIn size={18} />}
              {loading ? 'Signing in…' : 'Sign In to Command Center'}
            </button>
          </form>

          <div className="security-panel">
            <div className="security-panel-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="security-panel-text">
              <div className="security-panel-title">Authorized personnel only</div>
              <div className="security-panel-subtitle">All activities are monitored and logged.</div>
            </div>
          </div>

          <div className="process-line" aria-label="RakṣāSetu values">
            <span>PROTECT</span>
            <span>PREPARE</span>
            <span>RESPOND</span>
            <span>RECOVER</span>
          </div>

          <div className="tricolor-accent" aria-hidden="true" />

          <div className="process-tagline">A SAFER INDIA, A STRONGER TOMORROW</div>
        </div>
      </div>
    </div>
  );
}
