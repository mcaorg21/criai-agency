import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import BannerLayoutEditor from '../components/BannerLayoutEditor';

const OPENAI_MODELS = [
  { value: 'gpt-image-2', label: 'gpt-image-2', desc: 'Mais recente · Alta qualidade' },
  { value: 'gpt-image-1', label: 'gpt-image-1', desc: 'Versão anterior' },
];

const FLUX_MODELS = [
  { value: 'flux-2-klein-4b',    label: 'FLUX.2 Klein 4B',    price: '$0.014/MP', cost: 'Barato',     color: 'text-emerald-400' },
  { value: 'flux-2-klein-9b',    label: 'FLUX.2 Klein 9B',    price: '$0.015/MP', cost: 'Barato',     color: 'text-emerald-400' },
  { value: 'flux-2-pro',         label: 'FLUX.2 Pro',         price: '$0.03/MP',  cost: 'Moderado',   color: 'text-yellow-400'  },
  { value: 'flux-2-pro-preview', label: 'FLUX.2 Pro Preview', price: '$0.03/MP',  cost: 'Moderado',   color: 'text-yellow-400'  },
  { value: 'flux-2-flex',        label: 'FLUX.2 Flex',        price: '$0.06/MP',  cost: 'Caro',       color: 'text-orange-400'  },
  { value: 'flux-2-max',         label: 'FLUX.2 Max',         price: '$0.07/MP',  cost: 'Caro',       color: 'text-orange-400'  },
  { value: 'flux-kontext-pro',   label: 'Flux Kontext Pro',   price: '',          cost: 'Moderado',   color: 'text-yellow-400'  },
  { value: 'flux-kontext-max',   label: 'Flux Kontext Max',   price: '',          cost: 'Caro',       color: 'text-orange-400'  },
  { value: 'flux-pro-1.1-ultra', label: 'Flux Pro 1.1 Ultra', price: '',          cost: 'Muito caro', color: 'text-red-400'     },
  { value: 'flux-dev',           label: 'Flux Dev',           price: 'Grátis',    cost: 'Grátis',     color: 'text-gray-400'    },
];

const REPLICATE_MODELS = [
  { value: 'flux-pro-1.1',       label: 'FLUX 1.1 Pro',       price: '$0.04/img', cost: 'Moderado',   color: 'text-yellow-400'  },
  { value: 'flux-pro-1.1-ultra', label: 'FLUX 1.1 Pro Ultra', price: '$0.06/img', cost: 'Caro',       color: 'text-orange-400'  },
  { value: 'flux-kontext-pro',   label: 'Flux Kontext Pro',   price: '$0.04/img', cost: 'Moderado',   color: 'text-yellow-400'  },
  { value: 'flux-kontext-max',   label: 'Flux Kontext Max',   price: '$0.08/img', cost: 'Caro',       color: 'text-orange-400'  },
  { value: 'flux-dev',           label: 'Flux Dev',           price: '$0.003/img',cost: 'Barato',     color: 'text-emerald-400' },
  { value: 'flux-schnell',       label: 'Flux Schnell',       price: '$0.001/img',cost: 'Muito barato',color: 'text-emerald-400'},
];

const TONE_OPTIONS = [
  'Direto e objetivo', 'Persuasivo', 'Emocional', 'Urgente',
  'Descontraído', 'Técnico / especialista', 'Inspiracional',
  'Institucional', 'Agressivo / impactante',
];

const CHANNEL_OPTIONS = [
  'Google Display', 'Instagram Feed', 'Instagram Story',
  'Facebook Feed', 'Facebook Story', 'TikTok', 'Email Marketing', 'YouTube',
];

export default function EditCreative() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [clientLogos, setClientLogos] = useState([]);
  const [selectedLogoUrl, setSelectedLogoUrl] = useState('');

  useEffect(() => {
    api.creatives.get(id).then((c) => {
      const allColors = c.color_palette
        ? c.color_palette.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      setForm({
        target_audience: c.target_audience || '',
        campaign_objective: c.campaign_objective || '',
        main_offer: c.main_offer || '',
        desired_tone: c.desired_tone ? c.desired_tone.split(',').map(s => s.trim()).filter(Boolean) : [],
        channels: c.channels || [],
        observations: c.observations || '',
        selected_colors: c.selected_colors || [],
        simulate_audience: c.simulate_audience ?? true,
        email_unsubscribe_footer: c.email_unsubscribe_footer ?? true,
        email_utm_source: c.email_utm_source || '',
        email_utm_medium: c.email_utm_medium || 'email',
        email_utm_campaign: c.email_utm_campaign || '',
        banner_provider: c.banner_provider || 'gemini',
        flux_model: c.flux_model || 'flux-2-pro',
        openai_model: c.openai_model || 'gpt-image-2',
        replicate_model: c.replicate_model || 'flux-pro-1.1',
        logo_position: c.logo_position || 'top-left',
        logo_invert: c.logo_invert ?? false,
        num_copies: c.num_copies || 3,
        layout_zones: c.layout_zones || [],
        brand_name: c.brand_name,
        all_colors: allColors,
        client_id: c.client_id,
      });

      // Load client logos and restore previously selected logo
      api.clients.get(c.client_id).then(cl => {
        const logos = cl.logos || [];
        setClientLogos(logos);
        const previousUrl = c.selected_logo_url || (c.use_logo ? c.logo_url : '');
        const match = logos.find(l => l.url === previousUrl);
        setSelectedLogoUrl(match ? match.url : (logos.length > 0 && c.use_logo ? logos[0].url : ''));
      });
    });
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleMulti = (k, val) => {
    setForm((f) => {
      const arr = f[k];
      return { ...f, [k]: arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.channels.length === 0) return alert('Selecione pelo menos um canal');
    setLoading(true);
    try {
      await api.creatives.update(id, {
        ...form,
        desired_tone: form.desired_tone.join(', '),
        use_logo: !!selectedLogoUrl,
        selected_logo_url: selectedLogoUrl || null,
        logo_position: selectedLogoUrl ? form.logo_position : 'top',
        logo_invert: selectedLogoUrl ? form.logo_invert : false,
        banner_provider: form.banner_provider,
        flux_model: form.banner_provider === 'flux' ? form.flux_model : null,
        openai_model: form.banner_provider === 'openai' ? form.openai_model : null,
        replicate_model: form.banner_provider === 'replicate' ? form.replicate_model : null,
      });
      navigate(`/creatives/${id}`);
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  if (!form) return <div className="text-gray-500 text-sm">Carregando...</div>;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-300 text-sm">← Voltar</button>
        </div>
        <h1 className="text-2xl font-bold text-white">Editar Criativo</h1>
        <p className="text-gray-400 text-sm mt-0.5">{form.brand_name} — ajuste o briefing e regere</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {(clientLogos.length > 0 || form.all_colors?.length > 0) && (
          <div className="card space-y-3">
            {clientLogos.length > 0 && (
              <div>
                <p className="text-sm text-gray-300 font-medium mb-2.5">Logo nos criativos</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedLogoUrl('')}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      !selectedLogoUrl
                        ? 'border-brand-500 bg-brand-500/10 text-brand-400'
                        : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    Sem logo
                  </button>
                  {clientLogos.map((logo) => (
                    <button
                      type="button"
                      key={logo.id}
                      onClick={() => setSelectedLogoUrl(logo.url)}
                      className={`relative flex flex-col items-center p-1.5 rounded-lg border transition-all ${
                        selectedLogoUrl === logo.url
                          ? 'border-brand-500 bg-brand-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={logo.url}
                        alt={logo.label || 'Logo'}
                        className="h-10 w-10 object-contain rounded bg-white/5"
                      />
                      {logo.label && (
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[52px] truncate">{logo.label}</p>
                      )}
                    </button>
                  ))}
                </div>
                {selectedLogoUrl && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.logo_invert}
                        onChange={(e) => setForm(f => ({ ...f, logo_invert: e.target.checked }))}
                        className="w-4 h-4 accent-brand-500"
                      />
                      <span className="text-xs text-gray-400">Inverter cor da logo (para branco)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {form.all_colors?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-300 font-medium">Paleta de cores</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm(f => ({ ...f, selected_colors: [...f.all_colors] }))}
                      className="text-xs text-brand-400 hover:text-brand-300">Todas</button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, selected_colors: [] }))}
                      className="text-xs text-gray-500 hover:text-gray-300">Limpar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.all_colors.map((hex) => {
                    const selected = (form.selected_colors || []).includes(hex);
                    return (
                      <button
                        type="button"
                        key={hex}
                        onClick={() => setForm(f => {
                          const cur = f.selected_colors || [];
                          return { ...f, selected_colors: cur.includes(hex) ? cur.filter(c => c !== hex) : [...cur, hex] };
                        })}
                        title={hex}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all ${
                          selected ? 'border-brand-500 bg-brand-500/10 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <span className="w-4 h-4 rounded-sm shrink-0 border border-white/10" style={{ backgroundColor: hex }} />
                        {hex}
                      </button>
                    );
                  })}
                </div>
                {(form.selected_colors?.length > 0) && (
                  <p className="text-xs text-gray-500 mt-2">
                    {form.selected_colors.length} cor{form.selected_colors.length > 1 ? 'es' : ''} selecionada{form.selected_colors.length > 1 ? 's' : ''} — usadas nos banners e influenciam os copies
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="card space-y-5">
          <p className="section-title">Briefing</p>

          <div>
            <label className="label">Objetivo da campanha *</label>
            <textarea className="input resize-none" rows={3} value={form.campaign_objective}
              onChange={set('campaign_objective')} required />
          </div>

          <div>
            <label className="label">Persona / público-alvo *</label>
            <textarea className="input resize-none" rows={3} value={form.target_audience}
              onChange={set('target_audience')} required />
          </div>

          <div>
            <label className="label">Oferta principal</label>
            <input className="input" value={form.main_offer} onChange={set('main_offer')} />
          </div>
        </div>

        <div className="card">
          <p className="section-title">Tom de comunicação</p>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((t) => (
              <button type="button" key={t} onClick={() => toggleMulti('desired_tone', t)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  form.desired_tone.includes(t)
                    ? 'bg-brand-500 border-brand-500 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="section-title">Canais</p>
          <div className="grid grid-cols-2 gap-2">
            {CHANNEL_OPTIONS.map((ch) => (
              <button type="button" key={ch} onClick={() => toggleMulti('channels', ch)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium border text-left transition-colors ${
                  form.channels.includes(ch)
                    ? 'bg-brand-500/10 border-brand-500 text-brand-400'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}>
                {ch}
              </button>
            ))}
          </div>

          {form.channels.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700/60">
              <label className="label mb-2">Quantas variações de criativo?</label>
              <div className="flex gap-2">
                {[1, 3, 6].map(n => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setForm(f => ({ ...f, num_copies: n }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                      form.num_copies === n
                        ? 'bg-brand-500/10 border-brand-500 text-brand-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                {form.num_copies === 1 ? 'Gera 1 criativo — mais rápido e barato' : form.num_copies === 3 ? 'Gera 3 variações para testar ângulos diferentes' : 'Gera 6 variações — máximo de opções para A/B test'}
              </p>
            </div>
          )}
        </div>

        {form.channels.includes('Email Marketing') && (
          <div className="card space-y-4">
            <p className="section-title">Opções — Email Marketing</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.email_unsubscribe_footer}
                onChange={(e) => setForm((f) => ({ ...f, email_unsubscribe_footer: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-brand-500 shrink-0"
              />
              <div>
                <p className="text-sm text-gray-200 font-medium">Incluir footer de descadastro</p>
                <p className="text-xs text-gray-500 mt-0.5">Adiciona rodapé com link para o destinatário se descadastrar da lista</p>
              </div>
            </label>
            <div>
              <p className="text-sm text-gray-300 font-medium mb-2">Parâmetros UTM dos botões CTA</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label text-xs">utm_source</label>
                  <input className="input text-sm" value={form.email_utm_source} onChange={set('email_utm_source')} placeholder="ex: newsletter" />
                </div>
                <div>
                  <label className="label text-xs">utm_medium</label>
                  <input className="input text-sm" value={form.email_utm_medium} onChange={set('email_utm_medium')} placeholder="email" />
                </div>
                <div>
                  <label className="label text-xs">utm_campaign</label>
                  <input className="input text-sm" value={form.email_utm_campaign} onChange={set('email_utm_campaign')} placeholder="ex: promo-abril" />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">Todos os links dos CTAs do email receberão esses parâmetros automaticamente</p>
            </div>
          </div>
        )}

        {form.channels.some(ch => ch !== 'Email Marketing') && (
          <div className="card space-y-4">
            <p className="section-title">Gerador de banners PNG</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'gemini',    label: 'Gemini',     desc: 'Google AI' },
                { value: 'openai',   label: 'OpenAI',     desc: form.openai_model || 'gpt-image-2' },
                { value: 'flux',     label: 'Flux (BFL)',  desc: FLUX_MODELS.find(m => m.value === form.flux_model)?.label || 'FLUX.2 Pro' },
                { value: 'replicate',label: 'Replicate',  desc: REPLICATE_MODELS.find(m => m.value === form.replicate_model)?.label || 'FLUX 1.1 Pro' },
              ].map(({ value, label, desc }) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setForm(f => ({ ...f, banner_provider: value }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.banner_provider === value
                      ? 'bg-brand-500/10 border-brand-500'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className={`text-sm font-medium ${form.banner_provider === value ? 'text-brand-400' : 'text-gray-300'}`}>{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            {form.banner_provider === 'openai' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Modelo OpenAI</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {OPENAI_MODELS.map(m => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, openai_model: m.value }))}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                        form.openai_model === m.value
                          ? 'bg-brand-500/10 border-brand-500'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className={`text-sm font-medium ${form.openai_model === m.value ? 'text-brand-400' : 'text-gray-300'}`}>
                        {m.label}
                      </span>
                      <span className="text-xs text-gray-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.banner_provider === 'flux' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Modelo Flux (via BFL)</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {FLUX_MODELS.map(m => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, flux_model: m.value }))}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                        form.flux_model === m.value
                          ? 'bg-brand-500/10 border-brand-500'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className={`text-sm font-medium ${form.flux_model === m.value ? 'text-brand-400' : 'text-gray-300'}`}>
                        {m.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.price && <span className="text-xs text-gray-600">{m.price}</span>}
                        <span className={`text-xs font-medium ${m.color}`}>{m.cost}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.banner_provider === 'replicate' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Modelo Flux via Replicate</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {REPLICATE_MODELS.map(m => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, replicate_model: m.value }))}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                        form.replicate_model === m.value
                          ? 'bg-brand-500/10 border-brand-500'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <span className={`text-sm font-medium ${form.replicate_model === m.value ? 'text-brand-400' : 'text-gray-300'}`}>
                        {m.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {m.price && <span className="text-xs text-gray-600">{m.price}</span>}
                        <span className={`text-xs font-medium ${m.color}`}>{m.cost}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card space-y-4">
          <p className="section-title">Observações adicionais</p>
          <textarea className="input resize-none" rows={3} value={form.observations}
            onChange={set('observations')} placeholder="Instruções extras para a geração..." />
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.simulate_audience}
              onChange={(e) => setForm((f) => ({ ...f, simulate_audience: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-brand-500 shrink-0"
            />
            <div>
              <p className="text-sm text-gray-200 font-medium">Simular reação do público</p>
              <p className="text-xs text-gray-500 mt-0.5">A IA simula como a persona reagiria aos criativos gerados</p>
            </div>
          </label>
        </div>

        {/* Layout visual */}
        <div className="card space-y-3">
          <div>
            <p className="section-title">Layout do banner (opcional)</p>
            <p className="text-xs text-gray-500 mt-0.5">Defina a disposição visual dos elementos. A IA usará como referência para montar o criativo.</p>
          </div>
          <BannerLayoutEditor
            value={form.layout_zones}
            onChange={(zones) => setForm(f => ({ ...f, layout_zones: zones }))}
          />
        </div>

        <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
          {loading ? 'Salvando...' : '✦ Salvar e regerar criativo'}
        </button>
      </form>
    </div>
  );
}
