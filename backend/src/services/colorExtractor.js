const FETCH_OPTS = {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CriaiBrandReader/1.0)' },
};

export async function extractColorsFromUrl(rawUrl) {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const base = new URL(url);

  const html = await safeFetch(url);
  if (!html) return [];

  // Collect inline + style-tag CSS from HTML
  let cssText = extractInlineCss(html);

  // Find linked CSS files and fetch them (max 5)
  const cssUrls = extractCssLinks(html, base).slice(0, 5);
  const cssFiles = await Promise.all(cssUrls.map((u) => safeFetch(u)));
  cssText += ' ' + cssFiles.filter(Boolean).join(' ');

  // Also scan raw HTML for hex colors (buttons, inline styles, meta tags)
  const allText = html + ' ' + cssText;

  const freq = parseColors(allText);
  return rankColors(freq);
}

async function safeFetch(url) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { ...FETCH_OPTS, signal: ctrl.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractInlineCss(html) {
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  return styleBlocks.map((m) => m[1]).join(' ');
}

function extractCssLinks(html, base) {
  const links = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
  const re2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi;
  for (const m of [...html.matchAll(re), ...html.matchAll(re2)]) {
    try {
      links.push(new URL(m[1], base).href);
    } catch { /* skip malformed */ }
  }
  return [...new Set(links)];
}

function parseColors(text) {
  const freq = {};

  // Hex colors: #RGB and #RRGGBB
  for (const [, hex] of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g)) {
    const normalized = normalizeHex(hex);
    if (normalized) freq[normalized] = (freq[normalized] || 0) + 1;
  }

  // rgb(r, g, b)
  for (const [, r, g, b] of text.matchAll(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi)) {
    const hex = rgbToHex(+r, +g, +b);
    if (hex) freq[hex] = (freq[hex] || 0) + 1;
  }

  // CSS custom properties with hex values: --color-xxx: #xxxxxx
  for (const [, hex] of text.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\b/g)) {
    const normalized = normalizeHex(hex.slice(1));
    if (normalized) freq[normalized] = (freq[normalized] || 0) + 3; // weight custom props higher
  }

  return freq;
}

function normalizeHex(hex) {
  let full = hex.length === 3
    ? hex.split('').map((c) => c + c).join('')
    : hex;
  full = full.toLowerCase();
  const [r, g, b] = hexToRgb(full);
  if (isNearWhite(r, g, b) || isNearBlack(r, g, b) || isGray(r, g, b)) return null;
  return '#' + full;
}

function rgbToHex(r, g, b) {
  if (isNearWhite(r, g, b) || isNearBlack(r, g, b) || isGray(r, g, b)) return null;
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function isNearWhite(r, g, b) { return r > 220 && g > 220 && b > 220; }
function isNearBlack(r, g, b) { return r < 35 && g < 35 && b < 35; }
function isGray(r, g, b) { return Math.max(r, g, b) - Math.min(r, g, b) < 18; }

function rankColors(freq) {
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex]) => hex);
}
