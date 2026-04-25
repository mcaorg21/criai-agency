import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function StatCard({ label, value, color, icon }) {
  const theme = {
    brand:  { text: '#818cf8', glow: 'rgba(99,102,241,0.15)',  iconBg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.2)' },
    green:  { text: '#34d399', glow: 'rgba(16,185,129,0.15)',  iconBg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)' },
    yellow: { text: '#fbbf24', glow: 'rgba(245,158,11,0.15)',  iconBg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  }[color];

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -20, right: -20, width: 80, height: 80,
        borderRadius: '50%', background: theme.glow, filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="font-display text-3xl font-bold mt-2" style={{ color: theme.text }}>{value}</p>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: theme.iconBg,
          border: `1px solid ${theme.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: theme.text,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function statusBadge(status) {
  const map = { done: 'badge-done', running: 'badge-running', error: 'badge-error', cancelled: 'badge-cancelled' };
  const labels = { done: 'Pronto', running: 'Gerando...', error: 'Erro', cancelled: 'Cancelado' };
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{labels[status] || 'Pendente'}</span>;
}

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [creatives, setCreatives] = useState([]);

  useEffect(() => {
    api.clients.list().then(setClients).catch(() => {});
    api.creatives.list().then(setCreatives).catch(() => {});
  }, []);

  const done = creatives.filter(c => c.status === 'done').length;
  const running = creatives.filter(c => c.status === 'running').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>
          Bem-vindo ao{' '}
          <span style={{ background: 'linear-gradient(90deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Criai
          </span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Gere criativos profissionais com IA em segundos.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Clientes" value={clients.length} color="brand"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
        <StatCard label="Criativos gerados" value={done} color="green"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <StatCard label="Em processamento" value={running} color="yellow"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Link to="/clients/new" className="card block group" style={{ textDecoration: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
          <div className="flex items-center gap-4">
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Novo Cliente</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Cadastre marca, site e paleta</p>
            </div>
          </div>
        </Link>

        <Link to="/creatives/new" className="card block group" style={{ textDecoration: 'none', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
          <div className="flex items-center gap-4">
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Gerar Criativo</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Copies, banners e email HTML</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent creatives */}
      {creatives.length > 0 && (
        <div>
          <p className="section-title">Últimos criativos</p>
          <div className="space-y-2">
            {creatives.slice(0, 5).map(c => (
              <Link key={c.id} to={`/creatives/${c.id}`} className="card flex items-center justify-between py-4"
                style={{ textDecoration: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{c.brand_name}</p>
                  <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{c.campaign_objective}</p>
                </div>
                {statusBadge(c.status)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
