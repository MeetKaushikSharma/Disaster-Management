import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
<<<<<<< HEAD
  LayoutDashboard, AlertTriangle, BookOpen, FileText,
  LogOut, PlusCircle, BrainCircuit, Radio
=======
  LayoutDashboard, TriangleAlert, BookOpen, FileText,
  LogOut, CirclePlus
>>>>>>> 1168dca (Initial secure commit)
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
        <div className="sidebar-top-accent" aria-hidden="true" />

        <div className="sidebar-brand">
          <img
<<<<<<< HEAD
            src="/RakṣāSetu.png"
=======
            src="/MainLogo.png"
>>>>>>> 1168dca (Initial secure commit)
            alt="RakṣāSetu logo"
            className="sidebar-logo-mark"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/raksasetu-mark.svg';
            }}
          />
          <div className="sidebar-brand-copy">
            <div className="sidebar-logo-text">RakṣāSetu</div>
<<<<<<< HEAD
            <div className="sidebar-logo-sub">India SDMA Portal</div>
=======
            <div className="sidebar-logo-sub">COMMAND CENTER</div>
>>>>>>> 1168dca (Initial secure commit)
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Sidebar navigation">
          <div className="sidebar-section">
            <div className="sidebar-section-label">Overview</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/situational-awareness" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Radio size={16} />
              Citizen Awareness
            </NavLink>
          </div>

          <div className="sidebar-section">
<<<<<<< HEAD
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
=======
            <div className="sidebar-section-label">Alerts</div>
            <NavLink to="/events" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <TriangleAlert size={16} />
              <span>Disaster Events</span>
>>>>>>> 1168dca (Initial secure commit)
            </NavLink>
            <NavLink to="/events/new" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <CirclePlus size={16} />
              <span>New Event</span>
            </NavLink>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Content & Audit</div>
            <NavLink to="/guides" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <BookOpen size={16} />
              <span>Safety Guides</span>
            </NavLink>
            <NavLink to="/logs" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <FileText size={16} />
              <span>Alert Logs</span>
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-admin-meta">
            <div className="sidebar-admin-name">{admin?.name || 'System Admin'}</div>
            <div className="sidebar-admin-email">{admin?.email}</div>
          </div>
          <button type="button" className="sidebar-signout" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Sign out</span>
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
