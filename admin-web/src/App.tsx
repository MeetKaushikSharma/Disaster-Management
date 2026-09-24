import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import NewEventPage from './pages/NewEventPage';
import GuidesPage from './pages/GuidesPage';
import LogsPage from './pages/LogsPage';
import AiAnomalyHubPage from './pages/AiAnomalyHubPage';
import SituationalAwarenessPage from './pages/SituationalAwarenessPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

export default function App() {
  const [introFinished, setIntroFinished] = useState(false);

  /*
   * Show the intro video first.
   * The application routes are not rendered until
   * the video has completely finished.
   */
  if (!introFinished) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 999999,
        }}
      >
        <video
          autoPlay
          muted
          playsInline
          onEnded={() => setIntroFinished(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src="/intro-video.mp4" type="video/mp4" />
        </video>
      </div>
    );
  }

  /*
   * Existing application routing.
   * Nothing else has been changed.
   */
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<Navigate to="/dashboard" replace />}
        />

        <Route
          path="dashboard"
          element={<DashboardPage />}
        />

        <Route
          path="ai-hub"
          element={<AiAnomalyHubPage />}
        />

        <Route
          path="situational-awareness"
          element={<SituationalAwarenessPage />}
        />

        <Route
          path="events"
          element={<EventsPage />}
        />

        <Route
          path="events/new"
          element={<NewEventPage />}
        />

        <Route
          path="guides"
          element={<GuidesPage />}
        />

        <Route
          path="logs"
          element={<LogsPage />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />
    </Routes>
  );
}