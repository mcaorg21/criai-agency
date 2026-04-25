import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.clients.list().then(setClients).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Excluir este cliente?')) return;
    await api.clients.delete(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Clientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Gerencie suas marcas cadastradas</p>
        </div>
        <Link to="/clients/new" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo cliente
        </Link>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</div>
      ) : clients.length === 0 ? (
        <div className="card text-center py-16">
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Nenhum cliente ainda</p>
          <p className="text-xs mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>Cadastre sua primeira marca para começar</p>
          <Link to="/clients/new" className="btn-primary" style={{ display: 'inline-flex' }}>Cadastrar primeiro cliente</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {clients.map(c => (
            <div key={c.id} className="card flex items-center justify-between py-4"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <div className="flex items-center gap-4">
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                  border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#818cf8', fontWeight: 700, fontSize: 13,
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}>
                  {c.brand_name[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.brand_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.site_url}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link to={`/clients/${c.id}/edit`} className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>Editar</Link>
                <button onClick={() => handleDelete(c.id)} style={{
                  fontSize: '12px', padding: '6px 12px', borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#f87171', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
