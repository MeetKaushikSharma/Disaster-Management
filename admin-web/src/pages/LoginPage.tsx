import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle } from 'lucide-react';
import { login } from '../api/services';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-box">
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Disaster Management</div>
            <div style={{ fontSize: 11, color: 'var(--grey-500)' }}>Admin Portal · India</div>
          </div>
        </div>

        <h1 style={{ fontSize: 20, marginBottom: 6 }}>Sign in</h1>
        <p style={{ marginBottom: 24, fontSize: 13 }}>Enter your credentials to access the dashboard.</p>

        {error && (
          <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@disaster.gov.in"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            id="btn-login"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 11, color: 'var(--grey-400)', textAlign: 'center' }}>
          Access restricted to verified administrators only
        </p>
      </div>
    </div>
  );
}
