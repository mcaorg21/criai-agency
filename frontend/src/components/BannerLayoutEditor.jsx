import { useState, useRef, useCallback } from 'react';

const ZONE_TYPES = [
  { type: 'figura',        label: 'Figura / Imagem', color: '#f97316' },
  { type: 'logo',          label: 'Logo',            color: '#8b5cf6' },
  { type: 'headline',      label: 'Headline',        color: '#6366f1' },
  { type: 'texto_central', label: 'Texto Central',   color: '#10b981' },
  { type: 'texto_apoio',   label: 'Texto de Apoio',  color: '#f59e0b' },
  { type: 'cta',           label: 'Botão CTA',       color: '#ef4444' },
];

const ASPECT_RATIOS = [
  { label: '1:1',  value: '1:1',  h: 1     },
  { label: '9:16', value: '9:16', h: 16/9  },
  { label: '16:9', value: '16:9', h: 9/16  },
  { label: '4:5',  value: '4:5',  h: 5/4   },
];

const DEFAULT_ZONES = [
  { id: 'figura_d',   type: 'figura',      label: 'Figura / Imagem', color: '#f97316', x: 0,  y: 0,  w: 100, h: 100 },
  { id: 'logo_d',     type: 'logo',        label: 'Logo',            color: '#8b5cf6', x: 5,  y: 5,  w: 28,  h: 10  },
  { id: 'headline_d', type: 'headline',    label: 'Headline',        color: '#6366f1', x: 5,  y: 28, w: 90,  h: 18  },
  { id: 'apoio_d',    type: 'texto_apoio', label: 'Texto de Apoio',  color: '#f59e0b', x: 5,  y: 50, w: 90,  h: 9   },
  { id: 'cta_d',      type: 'cta',         label: 'Botão CTA',       color: '#ef4444', x: 25, y: 80, w: 50,  h: 12  },
];

const CANVAS_W = 260;

export default function BannerLayoutEditor({ value, onChange }) {
  const [zones, setZones] = useState(() => value?.length ? value : DEFAULT_ZONES);
  const [aspect, setAspect] = useState('1:1');
  const [selected, setSelected] = useState(null);
  const [guideH, setGuideH] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const SNAP_THRESHOLD = 3; // % — distância para ativar o guia e snap

  const canvasH = Math.round(CANVAS_W * ASPECT_RATIOS.find(a => a.value === aspect).h);

  const commit = (newZones) => {
    setZones(newZones);
    onChange?.(newZones);
  };

  const selectedZone = zones.find(z => z.id === selected);

  const centerH = () => {
    if (!selectedZone) return;
    commit(zones.map(z => z.id === selected ? { ...z, x: (100 - z.w) / 2 } : z));
  };
  const centerV = () => {
    if (!selectedZone) return;
    commit(zones.map(z => z.id === selected ? { ...z, y: (100 - z.h) / 2 } : z));
  };
  const centerBoth = () => {
    if (!selectedZone) return;
    commit(zones.map(z => z.id === selected ? { ...z, x: (100 - z.w) / 2, y: (100 - z.h) / 2 } : z));
  };

  const addZone = (type) => {
    const info = ZONE_TYPES.find(t => t.type === type);
    const offset = zones.filter(z => z.type === type).length * 8;
    const zone = {
      id: `${type}_${Date.now()}`,
      type,
      label: info.label,
      color: info.color,
      x: 10 + offset,
      y: 10 + offset,
      w: type === 'logo' ? 30 : type === 'cta' ? 50 : 80,
      h: type === 'figura' ? 40 : type === 'logo' ? 10 : 12,
    };
    const next = [...zones, zone];
    commit(next);
    setSelected(zone.id);
  };

  const removeZone = (id) => {
    commit(zones.filter(z => z.id !== id));
    if (selected === id) setSelected(null);
  };

  const onMouseDown = useCallback((e, zoneId, action) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(zoneId);

    const zone = zones.find(z => z.id === zoneId);
    dragRef.current = { action, zoneId, startX: e.clientX, startY: e.clientY, startZone: { ...zone } };

    const onMove = (e) => {
      if (!dragRef.current) return;
      const { action, zoneId, startX, startY, startZone } = dragRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dx = ((e.clientX - startX) / canvas.offsetWidth) * 100;
      const dy = ((e.clientY - startY) / canvas.offsetHeight) * 100;
      setZones(prev => prev.map(z => {
        if (z.id !== zoneId) return z;
        if (action === 'move') {
          let newX = Math.max(0, Math.min(100 - z.w, startZone.x + dx));
          let newY = Math.max(0, Math.min(100 - z.h, startZone.y + dy));
          const cx = newX + z.w / 2;
          const snapH = Math.abs(cx - 50) < SNAP_THRESHOLD;
          setGuideH(snapH);
          if (snapH) newX = 50 - z.w / 2;
          return { ...z, x: newX, y: newY };
        }
        let { x, y, w, h } = startZone;
        if (action.includes('e')) w = Math.max(8, Math.min(100 - x, w + dx));
        if (action.includes('s')) h = Math.max(5, Math.min(100 - y, h + dy));
        if (action.includes('w')) {
          const newX = Math.max(0, Math.min(x + w - 8, x + dx));
          w = w - (newX - x); x = newX;
        }
        if (action.includes('n')) {
          const newY = Math.max(0, Math.min(y + h - 5, y + dy));
          h = h - (newY - y); y = newY;
        }
        return { ...z, x, y, w, h };
      }));
    };

    const onUp = () => {
      setZones(prev => { onChange?.(prev); return prev; });
      setGuideH(false);
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [zones, onChange]);

  return (
    <div className="space-y-3">
      {/* Aspect ratio */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-gray-500">Formato:</span>
        {ASPECT_RATIOS.map(ar => (
          <button type="button" key={ar.value} onClick={() => setAspect(ar.value)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
              aspect === ar.value ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-600'
            }`}>
            {ar.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-start">
        {/* Canvas */}
        <div className="flex flex-col gap-1.5">
          <div
            ref={canvasRef}
            className="relative bg-gray-950 border border-gray-700 rounded-lg overflow-hidden shrink-0 select-none"
            style={{ width: CANVAS_W, height: canvasH }}
            onClick={() => setSelected(null)}
          >
            {/* Grid */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '10% 10%',
            }} />
            {/* Center guides — sempre visíveis mas destacam ao snap */}
            <div className="absolute inset-0 pointer-events-none">
              <div className={`absolute left-1/2 top-0 bottom-0 border-l border-dashed transition-all duration-100 ${
                guideH ? 'border-brand-400/80' : 'border-white/5'
              }`} />
            </div>

            {zones.map(zone => {
              const isSel = selected === zone.id;
              return (
                <div
                  key={zone.id}
                  className="absolute rounded flex items-center justify-center cursor-move group"
                  style={{
                    left: `${zone.x}%`, top: `${zone.y}%`,
                    width: `${zone.w}%`, height: `${zone.h}%`,
                    backgroundColor: zone.color + (isSel ? '40' : '25'),
                    border: `2px solid ${isSel ? zone.color : zone.color + '80'}`,
                    zIndex: isSel ? 10 : 1,
                  }}
                  onMouseDown={(e) => onMouseDown(e, zone.id, 'move')}
                >
                  <span className="text-[9px] font-semibold truncate px-1 pointer-events-none"
                    style={{ color: zone.color, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                    {zone.label}
                  </span>

                  {/* Delete */}
                  <button type="button"
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:bg-red-500"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeZone(zone.id); }}>
                    ×
                  </button>

                  {/* Edge resize strips */}
                  <div className="absolute top-0 left-3 right-3 h-2 z-20" style={{ cursor: 'n-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, zone.id, 'resize-n'); }} />
                  <div className="absolute bottom-0 left-3 right-3 h-2 z-20" style={{ cursor: 's-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, zone.id, 'resize-s'); }} />
                  <div className="absolute top-3 bottom-3 left-0 w-2 z-20" style={{ cursor: 'w-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, zone.id, 'resize-w'); }} />
                  <div className="absolute top-3 bottom-3 right-0 w-2 z-20" style={{ cursor: 'e-resize' }}
                    onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, zone.id, 'resize-e'); }} />

                  {/* Corner handles */}
                  {[
                    { cls: 'top-0 left-0 items-start justify-start', cur: 'nw-resize', a: 'resize-nw' },
                    { cls: 'top-0 right-0 items-start justify-end',  cur: 'ne-resize', a: 'resize-ne' },
                    { cls: 'bottom-0 left-0 items-end justify-start',cur: 'sw-resize', a: 'resize-sw' },
                    { cls: 'bottom-0 right-0 items-end justify-end', cur: 'se-resize', a: 'resize-se' },
                  ].map(({ cls, cur, a }) => (
                    <div key={a}
                      className={`absolute ${cls} w-4 h-4 z-20 flex p-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}
                      style={{ cursor: cur }}
                      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, zone.id, a); }}>
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: zone.color, opacity: 0.9 }} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Snap / center toolbar — só aparece com zona selecionada */}
          <div className={`flex gap-1.5 transition-opacity ${selectedZone ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <button type="button" onClick={centerH}
              className="flex-1 py-1 rounded border border-gray-700 text-[10px] text-gray-400 hover:border-brand-500 hover:text-brand-400 transition-all"
              title="Centralizar horizontalmente">
              ↔ H
            </button>
            <button type="button" onClick={centerV}
              className="flex-1 py-1 rounded border border-gray-700 text-[10px] text-gray-400 hover:border-brand-500 hover:text-brand-400 transition-all"
              title="Centralizar verticalmente">
              ↕ V
            </button>
            <button type="button" onClick={centerBoth}
              className="flex-1 py-1 rounded border border-gray-700 text-[10px] text-gray-400 hover:border-brand-500 hover:text-brand-400 transition-all font-medium"
              title="Centralizar nos dois eixos">
              ⊕ Centro
            </button>
          </div>
          {selectedZone && (
            <p className="text-[10px] text-gray-600 text-center">
              {selectedZone.label} — x:{Math.round(selectedZone.x)}% y:{Math.round(selectedZone.y)}% · {Math.round(selectedZone.w)}×{Math.round(selectedZone.h)}%
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide mb-0.5">Adicionar zona</p>
          {ZONE_TYPES.map(zt => (
            <button type="button" key={zt.type} onClick={() => addZone(zt.type)}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-300 hover:border-gray-600 hover:bg-gray-800/60 transition-all text-left">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: zt.color }} />
              {zt.label}
            </button>
          ))}
          <div className="mt-1 flex gap-1.5">
            <button type="button"
              onClick={() => { commit(DEFAULT_ZONES); setSelected(null); }}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all">
              Resetar
            </button>
            <button type="button"
              onClick={() => { commit([]); setSelected(null); }}
              className="flex-1 px-2 py-1.5 rounded-lg border border-gray-800 text-xs text-gray-600 hover:text-red-400 hover:border-red-900/50 transition-all">
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Zone chips */}
      {zones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {zones.map(z => (
            <span key={z.id} onClick={() => setSelected(z.id)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-all"
              style={{
                backgroundColor: z.color + '20', color: z.color,
                borderColor: selected === z.id ? z.color : 'transparent',
              }}>
              {z.label}
              <span className="opacity-40">{Math.round(z.w)}×{Math.round(z.h)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
