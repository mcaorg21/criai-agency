import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedId, setSavedId] = useState(id || null);
  const [logos, setLogos] = useState([]);
  const [logoPreview, setLogoPreview] = useState(null); // only for new client mode
  const fileRef = useRef();

  const [form, setForm] = useState({
    brand_name: '',
    site_url: '',
    product_or_service: '',
    color_palette: '',
  });

  const [extractedColors, setExtractedColors] = useState([]);
  const [pickerColor, setPickerColor] = useState('#1a3a5c');
  const [paletteList, setPaletteList] = useState([]);

  const syncPalette = (list) => {
    setPaletteList(list);
    setForm((f) => ({ ...f, color_palette: list.join(', ') }));
  };

  useEffect(() => {
    if (isEdit) {
      api.clients.get(id).then((c) => {
        setForm({
          brand_name: c.brand_name || '',
          site_url: c.site_url || '',
          product_or_service: c.product_or_service || '',
          color_palette: c.color_palette || '',
        });
        setLogos(c.logos || []);
        if (c.color_palette) {
          const hexes = [...c.color_palette.matchAll(/#[0-9a-fA-F]{6}/gi)].map(m => m[0].toUpperCase());
          setPaletteList(hexes);
          setExtractedColors(hexes);
        }
      });
    }
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleExtractColors = async () => {
    if (!form.site_url) return;
    setExtracting(true);
    setExtractedColors([]);
    try {
      const { colors } = await api.brand.extractColors(form.site_url);
      const upper = colors.map(c => c.toUpperCase());
      setExtractedColors(upper);
      syncPalette(upper);
    } catch (err) {
      alert(err.message);
    } finally {
      setExtracting(false);
    }
  };

  const addPickerColor = () => {
    let hex = pickerColor.trim().toUpperCase();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9A-F]{6}$/.test(hex)) return;
    if (paletteList.includes(hex)) return;
    syncPalette([...paletteList, hex]);
  };

  const removeColor = (hex) => {
    syncPalette(paletteList.filter((c) => c !== hex));
  };

  const isSelected = (hex) => paletteList.includes(hex.toUpperCase());

  const toggleExtracted = (hex) => {
    const upper = hex.toUpperCase();
    if (paletteList.includes(upper)) {
      syncPalette(paletteList.filter((c) => c !== upper));
    } else {
      syncPalette([...paletteList, upper]);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (!savedId) {
      setLogoPreview(URL.createObjectURL(file));
      fileRef._pendingFile = file;
      return;
    }

    setUploadingLogo(true);
    try {
      const result = await api.brand.uploadLogo(savedId, file);
      setLogos(prev => [...prev, { id: result.logo_id, url: result.logo_url, label: '' }]);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async (logoId) => {
    if (!confirm('Remover esta logo?')) return;
    try {
      await api.brand.deleteLogo(savedId, logoId);
      setLogos(prev => prev.filter(l => l.id !== logoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let client;
      if (isEdit) {
        client = await api.clients.update(id, form);
      } else {
        client = await api.clients.create(form);
        setSavedId(client.id);
        if (fileRef._pendingFile) {
          await api.brand.uploadLogo(client.id, fileRef._pendingFile);
          fileRef._pendingFile = null;
        }
      }
      navigate('/clients');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Editar' : 'Novo'} Cliente</h1>
        <p className="text-gray-400 text-sm mt-0.5">Dados da marca para geração de criativos</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Logo(s) */}
        <div className="card">
          <label className="label">Logo{isEdit ? 's' : ''} da marca</label>

          {isEdit ? (
            /* Multi-logo grid */
            <div>
              <div className="flex flex-wrap gap-3">
                {logos.map((logo) => (
                  <div key={logo.id} className="relative group">
                    <div className="w-20 h-20 rounded-xl border border-gray-700 overflow-hidden bg-gray-800 flex items-center justify-center">
                      <img src={logo.url} alt={logo.label || 'Logo'} className="w-full h-full object-contain p-1.5" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLogo(logo.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-900 border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-500 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remover logo"
                    >✕</button>
                    {logo.label && (
                      <p className="text-xs text-gray-500 text-center mt-1 truncate w-20">{logo.label}</p>
                    )}
                  </div>
                ))}

                {/* Add tile */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center hover:border-brand-500 hover:bg-brand-500/5 transition-colors text-gray-600 hover:text-brand-400"
                >
                  {uploadingLogo ? (
                    <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="text-xl leading-none">+</span>
                      <span className="text-[10px] mt-1">Adicionar</span>
                    </>
                  )}
                </button>
              </div>
              {logos.length === 0 && !uploadingLogo && (
                <p className="text-xs text-gray-600 mt-2">Nenhuma logo cadastrada. Clique em + para adicionar.</p>
              )}
            </div>
          ) : (
            /* Single upload for new client */
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center cursor-pointer hover:border-brand-500 transition-colors overflow-hidden bg-gray-800"
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <span className="text-gray-500 text-xs text-center px-2">Clique para enviar</span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? 'Enviando...' : logoPreview ? 'Trocar logo' : 'Upload da logo'}
                </button>
                <p className="text-xs text-gray-600 mt-1.5">PNG, JPG ou SVG · Será usada nas peças</p>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        {/* Brand name */}
        <div className="card space-y-4">
          <div>
            <label className="label">Nome da marca *</label>
            <input className="input" value={form.brand_name} onChange={set('brand_name')} placeholder="Ex: Reforma Fácil" required />
          </div>

          {/* URL + extract colors */}
          <div>
            <label className="label">URL do site</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={form.site_url}
                onChange={set('site_url')}
                placeholder="https://exemplo.com.br"
                type="url"
              />
              <button
                type="button"
                onClick={handleExtractColors}
                disabled={!form.site_url || extracting}
                className="btn-secondary text-sm whitespace-nowrap shrink-0"
              >
                {extracting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Buscando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                    </svg>
                    Detectar cores
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Extracted color swatches */}
          {extractedColors.length > 0 && (
            <div>
              <p className="label">Cores detectadas no site — clique para selecionar/remover</p>
              <div className="flex gap-2 flex-wrap">
                {extractedColors.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => toggleExtracted(hex)}
                    title={hex}
                    className={`relative w-9 h-9 rounded-lg border-2 transition-all ${
                      isSelected(hex) ? 'border-white scale-110 shadow-lg' : 'border-gray-700 hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {isSelected(hex) && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color palette */}
          <div>
            <label className="label">Paleta de cores</label>

            {paletteList.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {paletteList.map((hex) => (
                  <div key={hex} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-600 bg-gray-800">
                    <span className="w-4 h-4 rounded-sm shrink-0 border border-white/10" style={{ backgroundColor: hex }} />
                    <span className="text-xs text-gray-300">{hex}</span>
                    <button
                      type="button"
                      onClick={() => removeColor(hex)}
                      className="text-gray-500 hover:text-red-400 text-xs leading-none ml-0.5"
                      title="Remover cor"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={pickerColor}
                onChange={(e) => setPickerColor(e.target.value)}
                className="w-10 h-9 rounded cursor-pointer border border-gray-700 bg-transparent p-0.5"
              />
              <input
                className="input flex-1"
                value={pickerColor}
                onChange={(e) => setPickerColor(e.target.value)}
                placeholder="#1A3B6E"
                maxLength={7}
              />
              <button
                type="button"
                onClick={addPickerColor}
                className="btn-secondary text-sm whitespace-nowrap shrink-0"
              >
                + Adicionar
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-1.5">Use o picker ou cole um hex · A detecção automática também preenche aqui</p>
          </div>
        </div>

        {/* Product */}
        <div className="card">
          <label className="label">Produto ou serviço</label>
          <textarea
            className="input resize-none"
            rows={4}
            value={form.product_or_service}
            onChange={set('product_or_service')}
            placeholder="Descreva o que a marca oferece, para quem e quais são os principais diferenciais..."
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/clients')}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
