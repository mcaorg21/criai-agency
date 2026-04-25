import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

function statusBadge(status) {
  const map = { done: 'badge-done', running: 'badge-running', error: 'badge-error', cancelled: 'badge-cancelled' };
  const labels = { done: 'Pronto', running: 'Gerando...', error: 'Erro', cancelled: 'Cancelado' };
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{labels[status] || 'Pendente'}</span>;
}

export default function Creatives() {
  const navigate = useNavigate();
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.creatives.list().then(setCreatives).finally(() => setLoading(false));
  }, []);

  const q = query.toLowerCase();
  const filtered = creatives.filter(c =>
    !q ||
    c.brand_name?.toLowerCase().includes(q) ||
    c.campaign_objective?.toLowerCase().includes(q) ||
    c.channels?.some(ch => ch.toLowerCase().includes(q))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Criativos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Histórico de criativos gerados</p>
        </div>
        <Link to="/creatives/new" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Novo criativo
        </Link>
      </div>

      {!loading && creatives.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="input pl-8 text-sm"
            placeholder="Buscar por cliente, objetivo ou canal..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</div>
      ) : creatives.length === 0 ? (
        <div className="card text-center py-16">
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 16px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)' }}>
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
          </div>
          <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>Nenhum criativo ainda</p>
          <p className="text-xs mt-1 mb-5" style={{ color: 'var(--text-muted)' }}>Gere seu primeiro criativo com IA</p>
          <Link to="/creatives/new" className="btn-primary" style={{ display: 'inline-flex' }}>Gerar primeiro criativo</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum criativo encontrado para "<span style={{ color: 'var(--text)' }}>{query}</span>"</p>
          <button className="text-xs mt-2" style={{ color: 'var(--accent)' }} onClick={() => setQuery('')}>Limpar busca</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="card flex items-center justify-between py-4"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/creatives/${c.id}`)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.11)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c.brand_name}</p>
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>{c.campaign_objective}</p>
                {c.channels?.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {c.channels.slice(0, 3).map(ch => (
                      <span key={ch} style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-muted)',
                      }}>{ch}</span>
                    ))}
                    {c.channels.length > 3 && (
                      <span style={{ fontSize: '11px', color: 'var(--text-subtle)', padding: '2px 4px' }}>+{c.channels.length - 3}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                {statusBadge(c.status)}
                <span className="text-xs hidden sm:block" style={{ color: 'var(--text-subtle)' }}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </span>
                <button className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px' }}
                  onClick={async e => { e.stopPropagation(); const novo = await api.creatives.duplicate(c.id); navigate(`/creatives/${novo.id}/edit`); }}>
                  Duplicar
                </button>
                <Link to={`/creatives/${c.id}/edit`} className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px' }}
                  onClick={e => e.stopPropagation()}>
                  Editar
                </Link>
                <button style={{
                  fontSize: '12px', padding: '5px 10px', borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: '#f87171', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={async e => {
                    e.stopPropagation();
                    if (!confirm('Deletar este criativo? Esta ação não pode ser desfeita.')) return;
                    await api.creatives.delete(c.id);
                    setCreatives(prev => prev.filter(x => x.id !== c.id));
                  }}>
                  Deletar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
