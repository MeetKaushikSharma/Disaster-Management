import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, BookOpen, FileText,
  LogOut, PlusCircle, BrainCircuit, Radio
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { admin, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img
            src="/RakṣāSetu.png"
            alt="RakṣāSetu logo"
            className="sidebar-logo-mark"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/raksasetu-mark.svg';
            }}
          />
          <div>
            <div className="sidebar-logo-text">RakṣāSetu</div>
            <div className="sidebar-logo-sub">India SDMA Portal</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-label">Overview</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <LayoutDashboard size={16} />
              Dashboard
            </NavLink>
            <NavLink to="/situational-awareness" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Radio size={16} />
              Citizen Awareness
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">AI & Early Warning</div>
            <NavLink to="/ai-hub" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <BrainCircuit size={16} />
              AI Anomaly Hub
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Alert Management</div>
            <NavLink to="/events" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <AlertTriangle size={16} />
              Disaster Events
            </NavLink>
            <NavLink to="/events/new" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <PlusCircle size={16} />
              New Event
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Content & Audit</div>
            <NavLink to="/guides" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <BookOpen size={16} />
              Safety Guides
            </NavLink>
            <NavLink to="/logs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <FileText size={16} />
              Alert Logs
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-admin-name">{admin?.name}</div>
          <div style={{ marginBottom: 10, marginTop: 2 }}>{admin?.email}</div>
          <button className="nav-item" onClick={handleLogout} style={{ padding: '8px 0', color: 'var(--grey-500)' }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
