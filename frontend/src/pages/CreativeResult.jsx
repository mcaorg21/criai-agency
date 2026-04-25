import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const STEPS = [
  { key: 'brand-reader',                   label: 'Analisando a marca' },
  { key: 'display-copy-builder',           label: 'Gerando copies' },
  { key: 'display-creative-formatter',     label: 'Formatando estrutura visual' },
  { key: 'display-banner-renderer',        label: 'Templates HTML dos banners' },
  { key: 'multi-channel-adapter',          label: 'Adaptando por canal' },
  { key: 'ad-short-copy-generator',        label: 'Copies curtas' },
  { key: 'email-marketing-html-builder',   label: 'HTML do email' },
  { key: 'creative-performance-evaluator', label: 'Avaliando performance' },
  { key: 'audience-reaction-simulator',    label: 'Simulando reação do público' },
  { key: 'banner-generator',               label: 'Gerando banners' },
];

const TABS = [
  { key: 'brandAnalysis', label: 'Análise da Marca' },
  { key: 'copies', label: 'Copies' },
  { key: 'visualFormat', label: 'Formato Visual' },
  { key: 'bannerRenderer', label: 'Banner HTML' },
  { key: 'channelAdaptations', label: 'Por Canal' },
  { key: 'shortCopies', label: 'Copies Curtas' },
  { key: 'emailHtml', label: 'Email HTML' },
  { key: 'performanceEval', label: 'Performance' },
  { key: 'audienceReaction', label: 'Reação do Público' },
  { key: 'banners', label: '🖼 Banners PNG' },
];

function MarkdownBlock({ text }) {
  if (!text) return <p className="text-gray-500 text-sm italic">Não gerado para os canais selecionados.</p>;
  return (
    <div className="prose-dark whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
      {text}
    </div>
  );
}

const aspectClass = {
  square:    'aspect-square',
  vertical:  'aspect-[9/16]',
  landscape: 'aspect-video',
};

function BannerCard({ banner }) {
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <div className={`w-full overflow-hidden bg-gray-900 ${aspectClass[banner.orientation] || 'aspect-square'}`}>
        <img src={banner.url} alt={banner.label} className="w-full h-full object-contain" />
      </div>
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {banner.channels?.map((ch) => (
            <span key={ch} className="text-xs bg-brand-500/10 text-brand-400 px-2 py-0.5 rounded-full">{ch}</span>
          ))}
        </div>
        <p className="text-gray-500 text-xs">{banner.label} · {banner.aspectRatio}</p>
        <a
          href={banner.url}
          download={`banner_c${banner.copyIndex ?? 1}_${banner.label.replace('×','x')}.png`}
          className="btn-secondary text-xs w-full text-center block py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          ↓ Baixar PNG
        </a>
      </div>
    </div>
  );
}

function BannersTab({ banners, bannerErrors, bannerGenerating, bannerStatus, bannerError, bannersLoading, bannerFailed, bannerFailedMsg, onGenerate }) {

  return (
    <div className="space-y-4">
      {bannersLoading ? (
        <div className="flex items-center gap-3 py-2">
          <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin shrink-0" />
          <span className="text-sm text-brand-400 animate-pulse">Gerando banners em background...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {bannerFailed && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="text-red-400 text-xs mt-0.5">✗</span>
              <div>
                <p className="text-red-400 text-xs font-medium">Geração automática falhou</p>
                {bannerFailedMsg && <p className="text-red-400/70 text-xs mt-0.5">{bannerFailedMsg}</p>}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={onGenerate}
              disabled={bannerGenerating}
              className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bannerGenerating ? '⏳ Gerando...' : banners?.length ? '↺ Regenerar Banners' : '✦ Gerar Banners'}
            </button>
            {bannerGenerating && bannerStatus && (
              <span className="text-xs text-brand-400 animate-pulse">{bannerStatus}</span>
            )}
            {!bannerGenerating && bannerError && (
              <span className="text-xs text-red-400">{bannerError}</span>
            )}
          </div>
        </div>
      )}

      {!banners?.length && !bannerGenerating && !bannersLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm">Nenhum banner gerado ainda.</p>
          <p className="text-gray-600 text-xs mt-1">Configure a chave da API em Configurações e clique em Gerar Banners.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {banners?.length > 0 && (
            <p className="text-sm text-gray-400">
              {banners.length} banner{banners.length > 1 ? 's' : ''} gerado{banners.length > 1 ? 's' : ''}
            </p>
          )}
          {/* Agrupa por copyIndex */}
          {(() => {
            const copies = [...new Set((banners || []).map(b => b.copyIndex ?? 1))].sort((a, b) => a - b);
            if (copies.length <= 1) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {banners?.map((banner, i) => <BannerCard key={i} banner={banner} />)}
                </div>
              );
            }
            return copies.map(ci => (
              <div key={ci}>
                <p className="text-xs font-medium text-brand-400 mb-3 uppercase tracking-wide">Criativo {ci}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {banners.filter(b => (b.copyIndex ?? 1) === ci).map((banner, i) => (
                    <BannerCard key={i} banner={banner} />
                  ))}
                </div>
              </div>
            ));
          })()}

          {bannerErrors?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500 font-medium">Formatos com erro:</p>
              {bannerErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-red-400 text-xs shrink-0 mt-0.5">✗ {e.label}</span>
                  <span className="text-red-400/80 text-xs break-all">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BannerHtmlBlock({ label, html }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current && html) ref.current.srcdoc = html;
  }, [html]);

  const copy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `banner-${label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
    a.click();
  };

  const dims = label.match(/(\d+)[×x](\d+)/);
  const iframeHeight = dims ? Math.min(parseInt(dims[2]), 650) : 320;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300 font-medium">{label}</span>
        <div className="flex gap-2">
          <button onClick={copy} className="btn-ghost text-xs">
            {copied ? '✓ Copiado!' : 'Copiar código'}
          </button>
          <button onClick={download} className="btn-secondary text-xs">
            ↓ Baixar HTML
          </button>
        </div>
      </div>
      <iframe
        ref={ref}
        className="w-full rounded-xl border border-gray-700 bg-white"
        style={{ height: `${iframeHeight}px` }}
        title={`Banner ${label}`}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

function extractHtml(raw) {
  if (!raw) return '';
  // Strip markdown code fences if present
  const m = raw.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : raw.trim();
}

function BannerRendererTab({ data }) {
  if (!data) return <p className="text-gray-500 text-sm italic">Não gerado.</p>;

  // New format: array of { label, width, height, html }
  if (Array.isArray(data)) {
    if (!data.length) return <p className="text-gray-500 text-sm italic">Nenhum formato gerado.</p>;
    return (
      <div className="space-y-6">
        {data.map((item, i) => (
          <BannerHtmlBlock key={i} label={item.label} html={extractHtml(item.html)} />
        ))}
      </div>
    );
  }

  // Legacy format: single string with #### headings + ```html blocks
  const text = data;
  const headingRe = /#{1,6}\s*([^\n]+)/g;
  const codeRe = /```(?:html)?\n([\s\S]*?)```/g;
  const headings = [];
  const codes = [];
  let hm, cm;
  while ((hm = headingRe.exec(text)) !== null) headings.push({ index: hm.index, label: hm[1].trim() });
  while ((cm = codeRe.exec(text)) !== null) codes.push({ index: cm.index, html: cm[1].trim() });

  const blocks = [];
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    if (code.html.length < 50) continue;
    const preceding = headings.filter(h => h.index < code.index).pop();
    blocks.push({ label: preceding?.label || `Banner ${i + 1}`, html: code.html });
  }

  if (!blocks.length) return <MarkdownBlock text={text} />;

  return (
    <div className="space-y-6">
      {blocks.map((b, i) => (
        <BannerHtmlBlock key={i} label={b.label} html={b.html} />
      ))}
    </div>
  );
}

function EmailBlock({ html, index, total }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (ref.current && html) ref.current.srcdoc = html;
  }, [html]);

  const copy = () => {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = total > 1 ? `email-${index + 1}.html` : 'email.html';
    a.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {total > 1 && <span className="text-xs text-gray-500 font-medium">Criativo {index + 1}</span>}
        <div className="flex gap-2 ml-auto">
          <button onClick={copy} className="btn-ghost text-xs">
            {copied ? '✓ Copiado!' : 'Copiar código'}
          </button>
          <button onClick={download} className="btn-secondary text-xs">
            ↓ Baixar HTML
          </button>
        </div>
      </div>
      <iframe
        ref={ref}
        className="w-full rounded-xl border border-gray-700 bg-white"
        style={{ height: '600px' }}
        title={`Email Preview ${index + 1}`}
        sandbox="allow-same-origin"
      />
    </div>
  );
}

function HtmlPreview({ html }) {
  if (!html) return <p className="text-gray-500 text-sm italic">Não gerado (canal Email não selecionado).</p>;

  // Strip markdown code fences (```html ... ``` or ``` ... ```)
  const cleaned = html.replace(/^```(?:html)?\s*/gim, '').replace(/^```\s*$/gim, '');

  // Separa múltiplos documentos HTML se houver mais de um <!DOCTYPE / <html
  const parts = cleaned
    .split(/(?=<!DOCTYPE\s|<html[\s>])/i)
    .map(s => s.trim())
    // Só aceita partes que começam com DOCTYPE ou <html
    .filter(s => /^<!DOCTYPE\s|^<html[\s>]/i.test(s))
    // Descarta blocos com body vazio ou conteúdo insuficiente
    .filter(s => {
      const bodyContent = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? s;
      return bodyContent.replace(/<[^>]*>/g, '').trim().length > 30;
    })
    // Garante target="_blank" em todos os links
    .map(s => s.replace(/<a(\s[^>]*?)>/gi, (match, attrs) => {
      if (/\btarget=/i.test(attrs)) return match;
      return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
    }));

  return (
    <div className="space-y-6">
      {parts.map((part, i) => (
        <EmailBlock key={i} html={part} index={i} total={parts.length} />
      ))}
    </div>
  );
}

export default function CreativeResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creative, setCreative] = useState(null);
  const [activeTab, setActiveTab] = useState('copies');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [bannerGenerating, setBannerGenerating] = useState(false);
  const [bannerStatus, setBannerStatus] = useState('');
  const [bannerError, setBannerError] = useState('');
  const [bannersLoading, setBannersLoading] = useState(false);
  const bannerSseRef = useRef(null);
  const creativeIntervalRef = useRef(null);
  const bannerIntervalRef = useRef(null);

  const startBannerPoll = () => {
    if (bannerIntervalRef.current) return;
    setBannersLoading(true);
    bannerIntervalRef.current = setInterval(async () => {
      const updated = await api.creatives.get(id).catch(() => null);
      if (!updated) return;
      const status = updated.result_json?.bannerGenerationStatus;
      if (status && status !== 'pending') {
        clearInterval(bannerIntervalRef.current);
        bannerIntervalRef.current = null;
        setBannersLoading(false);
        setCreative((c) => ({ ...c, result_json: updated.result_json }));
      }
    }, 5000);
  };

  useEffect(() => {
    api.creatives.get(id).then((c) => {
      setCreative(c);
      if (c.status === 'pending' || c.status === 'running') {
        setGenerating(true);
        creativeIntervalRef.current = setInterval(async () => {
          const updated = await api.creatives.get(id).catch(() => null);
          if (!updated) return;
          setCreative(updated);
          if (updated.status === 'done') {
            clearInterval(creativeIntervalRef.current);
            creativeIntervalRef.current = null;
            setGenerating(false);
            if (updated.result_json?.bannerGenerationStatus === 'pending') startBannerPoll();
          } else if (updated.status === 'error' || updated.status === 'cancelled') {
            clearInterval(creativeIntervalRef.current);
            creativeIntervalRef.current = null;
            setGenerating(false);
            if (updated.status === 'error') setError('Ocorreu um erro na geração. Tente editar e gerar novamente.');
          }
        }, 3000);
      } else if (c.status === 'done' && c.result_json?.bannerGenerationStatus === 'pending') {
        startBannerPoll();
      }
    }).catch(() => setError('Criativo não encontrado'));

    return () => {
      if (creativeIntervalRef.current) clearInterval(creativeIntervalRef.current);
      if (bannerIntervalRef.current) clearInterval(bannerIntervalRef.current);
    };
  }, [id]);

  const startBannerGeneration = () => {
    if (bannerSseRef.current) bannerSseRef.current();
    if (bannerIntervalRef.current) { clearInterval(bannerIntervalRef.current); bannerIntervalRef.current = null; }
    setBannersLoading(false);
    setBannerGenerating(true);
    setBannerError('');
    setBannerStatus('Iniciando...');
    bannerSseRef.current = api.creatives.streamGenerateBanners(
      id,
      (data) => setBannerStatus(data.message || data.step),
      (data) => {
        setBannerGenerating(false);
        setBannerStatus('');
        bannerSseRef.current = null;
        setCreative((c) => ({
          ...c,
          result_json: {
            ...c.result_json,
            banners: data.banners,
            bannerErrors: data.bannerErrors?.length ? data.bannerErrors : undefined,
            bannerGenerationStatus: 'done',
          },
        }));
      },
      (msg) => {
        setBannerGenerating(false);
        setBannerStatus('');
        bannerSseRef.current = null;
        setBannerError(msg);
      }
    );
  };

  if (error) {
    return (
      <div className="">
        <div className="card text-center py-12">
          <p className="text-red-400 font-medium">{error}</p>
          <Link to="/creatives/new" className="btn-primary mt-4 inline-block">Novo criativo</Link>
        </div>
      </div>
    );
  }

  if (!creative) {
    return <div className="text-gray-500 text-sm">Carregando...</div>;
  }

  const results = creative.result_json || {};

  return (
    <div className="">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/creatives" className="text-gray-500 hover:text-gray-300 text-sm">← Criativos</Link>
          </div>
          <h1 className="text-2xl font-bold text-white">{creative.brand_name}</h1>
          <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{creative.campaign_objective}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm('Deletar este criativo? Esta ação não pode ser desfeita.')) return;
              await api.creatives.delete(id);
              navigate('/creatives');
            }}
            className="text-xs px-3 py-1 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Deletar
          </button>
          {(creative.status === 'pending' || creative.status === 'running' || generating) && (
            <button
              onClick={async () => {
                if (!confirm('Cancelar este criativo?')) return;
                await api.creatives.cancel(id);
                setGenerating(false);
                setCreative((c) => ({ ...c, status: 'cancelled' }));
              }}
              className="text-xs px-3 py-1 rounded-lg border border-red-800 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Cancelar
            </button>
          )}
          <span className={`badge ${
            creative.status === 'done' ? 'badge-done'
            : (creative.status === 'running' || generating) ? 'badge-running'
            : creative.status === 'error' ? 'badge-error'
            : creative.status === 'cancelled' ? 'badge-cancelled'
            : 'badge-neutral'
          }`}>
            {creative.status === 'done' ? 'Pronto'
              : generating ? 'Gerando...'
              : creative.status === 'error' ? 'Erro'
              : creative.status === 'cancelled' ? 'Cancelado'
              : 'Pendente'}
          </span>
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-4 h-4 rounded-full border-2 border-brand-500 border-t-transparent animate-spin shrink-0" />
            <p className="text-white font-medium text-sm">Gerando criativos com IA...</p>
            <span className="ml-auto text-xs text-gray-600">Pode sair desta tela</span>
          </div>
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const currentIdx = STEPS.findIndex(x => x.key === creative.current_step);
              const isDone = currentIdx > i || creative.current_step === 'done';
              const isActive = currentIdx === i;
              return (
                <div key={s.key} className={`flex items-center gap-2.5 text-xs transition-colors ${
                  isDone ? 'text-emerald-400' : isActive ? 'text-white' : 'text-gray-600'
                }`}>
                  <span className="w-4 text-center shrink-0 font-mono">
                    {isDone ? '✓' : isActive ? '→' : '○'}
                  </span>
                  <span>{s.label}</span>
                  {isActive && (
                    <span className="ml-auto text-brand-400 animate-pulse">em andamento</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results */}
      {creative.status === 'done' && Object.keys(results).length > 0 && (
        <div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 flex-wrap">
            {TABS.filter(({ key }) => {
              if (key === 'emailHtml') return !!results.emailHtml;
              if (key === 'bannerRenderer') return !!results.bannerRenderer;
              return true;
            }).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="card min-h-64">
            {activeTab === 'banners' ? (
              <BannersTab
                banners={results.banners}
                bannerErrors={results.bannerErrors}
                bannerGenerating={bannerGenerating}
                bannerStatus={bannerStatus}
                bannerError={bannerError}
                bannersLoading={bannersLoading}
                bannerFailed={results.bannerGenerationStatus === 'failed'}
                bannerFailedMsg={results.bannerError}
                onGenerate={startBannerGeneration}
              />
            ) : activeTab === 'emailHtml' ? (
              <HtmlPreview html={results.emailHtml} />
            ) : activeTab === 'bannerRenderer' ? (
              <BannerRendererTab data={results.bannerRenderer} />
            ) : (
              <>
                <div className="flex justify-end mb-3">
                  <button
                    onClick={() => navigator.clipboard.writeText(results[activeTab] || '')}
                    className="btn-ghost text-xs"
                  >
                    Copiar
                  </button>
                </div>
                <MarkdownBlock text={results[activeTab]} />
              </>
            )}
          </div>

          {/* Raw JSON */}
          <details className="mt-4">
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">Ver JSON completo</summary>
            <pre className="mt-2 bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-400 overflow-x-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {creative.status === 'error' && !generating && (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">A geração falhou ou foi interrompida.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={async () => {
                await api.creatives.retry(id);
                setCreative(c => ({ ...c, status: 'pending' }));
                setGenerating(true);
                setError(null);
              }}
              className="btn-primary"
            >
              ↺ Tentar novamente
            </button>
            <Link to={`/creatives/${id}/edit`} className="btn-secondary text-sm">Editar briefing</Link>
          </div>
        </div>
      )}
    </div>
  );
}
