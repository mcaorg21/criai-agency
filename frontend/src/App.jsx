import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import NewCreative from './pages/NewCreative';
import CreativeResult from './pages/CreativeResult';
import Creatives from './pages/Creatives';
import EditCreative from './pages/EditCreative';
import Settings from './pages/Settings';

const IconGrid = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const IconUsers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconSparkles = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
  </svg>
);

const IconCog = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const nav = [
  { to: '/', label: 'Dashboard', exact: true, icon: <IconGrid /> },
  { to: '/clients', label: 'Clientes', icon: <IconUsers /> },
  { to: '/creatives', label: 'Criativos', icon: <IconSparkles /> },
  { to: '/settings', label: 'Configurações', icon: <IconCog /> },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>

        {/* Sidebar */}
        <aside className="w-[230px] flex flex-col shrink-0" style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRight: '1px solid rgba(255,255,255,0.15)',
        }}>

          {/* Logo */}
          <div className="flex items-center justify-center py-5" style={{
            borderBottom: '1px solid rgba(255,255,255,0.15)',
          }}>
            <img src="/logos/logo_sem_margem.png" alt="Criai" className="h-6 w-auto" />
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 space-y-0.5">
            {nav.map(({ to, label, exact, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '9px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  ...(isActive ? {
                    background: 'rgba(255,255,255,0.2)',
                    color: '#ffffff',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                  } : {
                    color: 'rgba(255,255,255,0.7)',
                  }),
                })}
                onMouseEnter={e => {
                  if (!e.currentTarget.dataset.active) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = '#ffffff';
                  }
                }}
                onMouseLeave={e => {
                  if (!e.currentTarget.dataset.active) {
                    e.currentTarget.style.background = '';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <span style={{ opacity: 0.8, flexShrink: 0 }}>{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/new" element={<ClientForm />} />
              <Route path="/clients/:id/edit" element={<ClientForm />} />
              <Route path="/creatives" element={<Creatives />} />
              <Route path="/creatives/new" element={<NewCreative />} />
              <Route path="/creatives/:id" element={<CreativeResult />} />
              <Route path="/creatives/:id/edit" element={<EditCreative />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  );
}
