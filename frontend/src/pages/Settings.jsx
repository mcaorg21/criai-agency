import { useEffect, useState } from 'react';

async function getSettings() {
  const res = await fetch('/api/settings');
  return res.json();
}

async function saveSetting(key, value) {
  const res = await fetch(`/api/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Erro ao salvar');
}

const API_CONFIGS = [
  {
    key: 'anthropic_api_key',
    title: 'Anthropic API',
    label: 'Chave de API (sk-ant-...)',
    placeholder: 'sk-ant-api03-...',
    hint: 'Usada para geração de copies e análise de marca.',
    link: 'console.anthropic.com → API Keys',
  },
  {
    key: 'google_ai_api_key',
    title: 'Google AI (Gemini) — Banners',
    label: 'Chave de API (AIza...)',
    placeholder: 'AIzaSy...',
    hint: 'Usada para geração das imagens PNG dos banners via Gemini.',
    link: 'aistudio.google.com → Get API Key',
  },
  {
    key: 'openai_api_key',
    title: 'OpenAI — Banners (gpt-image-1)',
    label: 'Chave de API (sk-...)',
    placeholder: 'sk-proj-...',
    hint: 'Usada para geração das imagens PNG dos banners via gpt-image-1.',
    link: 'platform.openai.com → API Keys',
  },
  {
    key: 'replicate_api_key',
    title: 'Replicate — Banners via Flux',
    label: 'Chave de API (r8_...)',
    placeholder: 'r8_...',
    hint: 'Alternativa ao BFL direto para modelos Flux. Suporta FLUX 1.1 Pro, Kontext Pro/Max, Dev e Schnell.',
    link: 'replicate.com → Account → API tokens',
  },
];

function StatusDot({ active }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      background: active ? '#34d399' : '#f87171',
      boxShadow: active ? '0 0 6px rgba(52,211,153,0.4)' : 'none',
    }} />
  );
}

function ApiKeyCard({ config, initialHasKey }) {
  const [value, setValue] = useState('');
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    try {
      await saveSetting(config.key, value);
      setSaved(true);
      setHasKey(true);
      setValue('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <p className="section-title">{config.title}</p>
      <div className="flex items-center gap-2.5 mb-4">
        <StatusDot active={hasKey} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {hasKey ? 'Chave configurada' : 'Nenhuma chave salva'}
        </span>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">{hasKey ? 'Substituir chave atual' : config.label}</label>
          <input
            className="input font-mono text-sm"
            type="password"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={hasKey ? '•••••••••••• (deixe vazio para manter)' : config.placeholder}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading || !value.trim()}>
            {loading ? 'Salvando...' : 'Salvar chave'}
          </button>
          {saved && <span className="text-sm" style={{ color: '#34d399' }}>✓ Salva com sucesso</span>}
        </div>
      </form>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {config.hint} <span style={{ color: 'var(--text-muted)' }}>{config.link}</span>
        </p>
      </div>
    </div>
  );
}

function FluxCard({ initialHasKey }) {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setError('');
    setLoading(true);
    try {
      await saveSetting('flux_api_key', apiKey.trim());
      setSaved(true);
      setHasKey(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <p className="section-title">Flux — Black Forest Labs</p>
      <div className="flex items-center gap-2.5 mb-4">
        <StatusDot active={hasKey} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {hasKey ? 'Chave configurada' : 'Nenhuma chave salva'}
        </span>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">{hasKey ? 'Substituir chave atual' : 'Chave de API'}</label>
          <input
            className="input font-mono text-sm"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '•••••••••••• (deixe vazio para manter)' : 'Sua chave BFL (api.bfl.ml)'}
          />
        </div>
        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading || !apiKey.trim()}>
            {loading ? 'Salvando...' : 'Salvar chave'}
          </button>
          {saved && <span className="text-sm" style={{ color: '#34d399' }}>✓ Salva com sucesso</span>}
        </div>
      </form>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          Gerador de imagens alternativo ao Gemini. Obtenha sua chave em{' '}
          <span style={{ color: 'var(--text-muted)' }}>api.bfl.ml</span>.
          O modelo é escolhido por criativo na hora da criação.
        </p>
      </div>
    </div>
  );
}

function GcsCard({ initialBucket, initialHasKey }) {
  const [bucket, setBucket] = useState('');
  const [keyJson, setKeyJson] = useState('');
  const [hasBucket, setHasBucket] = useState(initialBucket);
  const [hasKey, setHasKey] = useState(initialHasKey);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (keyJson.trim()) {
      try { JSON.parse(keyJson); } catch {
        setError('JSON inválido — cole o conteúdo completo do arquivo de credenciais.');
        return;
      }
    }

    if (!bucket.trim() && !keyJson.trim()) return;
    setLoading(true);
    try {
      if (bucket.trim()) await saveSetting('gcs_bucket_name', bucket.trim());
      if (keyJson.trim()) await saveSetting('gcs_key_json', keyJson.trim());
      setSaved(true);
      if (bucket.trim()) setHasBucket(true);
      if (keyJson.trim()) setHasKey(true);
      setBucket('');
      setKeyJson('');
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const configured = hasBucket && hasKey;

  return (
    <div className="card">
      <p className="section-title">Google Cloud Storage — Logos</p>
      <div className="flex items-center gap-2.5 mb-4">
        <StatusDot active={configured} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {configured ? 'Configurado — logos enviadas para o GCS' : 'Não configurado — logos salvas localmente'}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="label">Nome do bucket</label>
          <input
            className="input font-mono text-sm"
            value={bucket}
            onChange={e => setBucket(e.target.value)}
            placeholder={hasBucket ? '•••••••• (deixe vazio para manter)' : 'meu-bucket-criai'}
          />
        </div>
        <div>
          <label className="label">Service Account JSON</label>
          <textarea
            className="input font-mono text-xs resize-none"
            rows={5}
            value={keyJson}
            onChange={e => setKeyJson(e.target.value)}
            placeholder={hasKey ? '•••••••• (deixe vazio para manter)' : '{ "type": "service_account", "project_id": "...", ... }'}
          />
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
            Cole o conteúdo do arquivo JSON da service account. O bucket precisa ter acesso público de leitura.
          </p>
        </div>

        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || (!bucket.trim() && !keyJson.trim())}
          >
            {loading ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {saved && <span className="text-sm" style={{ color: '#34d399' }}>✓ Salvo com sucesso</span>}
        </div>
      </form>

      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          Quando configurado, logos enviadas ficam em{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            storage.googleapis.com/&#123;bucket&#125;/logos/
          </span>{' '}
          — URL pública usada nos emails e banners.
        </p>
      </div>
    </div>
  );
}

export default function Settings() {
  const [settingsMap, setSettingsMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSettings().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      setSettingsMap(map);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--text)' }}>Configurações</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Chaves de API e integrações</p>
      </div>

      <div className="space-y-4 max-w-xl">
        {API_CONFIGS.map(config => (
          <ApiKeyCard key={config.key} config={config} initialHasKey={!!settingsMap[config.key]} />
        ))}
        <FluxCard initialHasKey={!!settingsMap['flux_api_key']} />
        <GcsCard
          initialBucket={!!settingsMap['gcs_bucket_name']}
          initialHasKey={!!settingsMap['gcs_key_json']}
        />
      </div>
    </div>
  );
}
