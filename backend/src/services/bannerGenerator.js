import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import pool from '../db/pool.js';
import { loadSkill } from './skillLoader.js';
import { uploadBannerToGcs, isGcsConfigured } from './gcsUploader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANNERS_DIR = join(__dirname, '../../uploads/banners');
mkdirSync(BANNERS_DIR, { recursive: true });

// Mapeamento canal → formato visual
const CHANNEL_FORMATS = {
  'Instagram Feed':   { aspectRatio: '1:1',  label: '1080×1080', orientation: 'square',    width: 1080, height: 1080 },
  'Facebook Feed':    { aspectRatio: '1:1',  label: '1080×1080', orientation: 'square',    width: 1080, height: 1080 },
  'Instagram Story':  { aspectRatio: '9:16', label: '1080×1920', orientation: 'vertical',  width: 1080, height: 1920 },
  'Facebook Story':   { aspectRatio: '9:16', label: '1080×1920', orientation: 'vertical',  width: 1080, height: 1920 },
  'TikTok':           { aspectRatio: '9:16', label: '1080×1920', orientation: 'vertical',  width: 1080, height: 1920 },
  'YouTube':          { aspectRatio: '16:9', label: '1280×720',  orientation: 'landscape', width: 1280, height: 720  },
};

// Google Display gera 5 formatos distintos
const GOOGLE_DISPLAY_FORMATS = [
  { label: '300×250',  aspectRatio: '6:5',    orientation: 'landscape',   width: 300,  height: 250, hint: 'medium rectangle' },
  { label: '336×280',  aspectRatio: '6:5',    orientation: 'landscape',   width: 336,  height: 280, hint: 'large rectangle'  },
  { label: '728×90',   aspectRatio: '728:90', orientation: 'leaderboard', width: 728,  height: 90,  hint: 'leaderboard banner, extremely wide and short' },
  { label: '300×600',  aspectRatio: '1:2',    orientation: 'vertical',    width: 300,  height: 600, hint: 'half page'        },
  { label: '320×100',  aspectRatio: '16:5',   orientation: 'landscape',   width: 320,  height: 100, hint: 'mobile banner'    },
];

// Retorna formatos únicos a gerar (Google Display expande em 5)
function getUniqueFormats(channels) {
  const seen = new Set();
  const formats = [];
  for (const ch of channels) {
    if (ch === 'Email Marketing') continue;

    if (ch === 'Google Display') {
      for (const gd of GOOGLE_DISPLAY_FORMATS) {
        if (!seen.has(gd.label)) {
          seen.add(gd.label);
          formats.push({ ...gd, channels: ['Google Display'] });
        }
      }
      continue;
    }

    const fmt = CHANNEL_FORMATS[ch];
    if (!fmt) continue;
    if (!seen.has(fmt.aspectRatio)) {
      seen.add(fmt.aspectRatio);
      formats.push({ ...fmt, channels: [ch] });
    } else {
      const existing = formats.find(f => f.aspectRatio === fmt.aspectRatio);
      existing?.channels.push(ch);
    }
  }
  return formats;
}

async function getAnthropicKey() {
  try {
    const res = await pool.query(`SELECT value FROM settings WHERE key = 'anthropic_api_key'`);
    return res.rows[0]?.value || process.env.ANTHROPIC_API_KEY;
  } catch { return process.env.ANTHROPIC_API_KEY; }
}

async function buildPromptsWithSkill({ copies, channelAdaptations, brandName, colors, productService, tone, channels, observations, logoUrl, bannerProvider, layoutZones }) {
  const skillMd = loadSkill('image-prompt-builder');
  const apiKey = await getAnthropicKey();
  const client = new Anthropic({ apiKey });

  const colorList = (typeof colors === 'string'
    ? colors.split(',').map(s => s.trim())
    : colors || []).join(', ');

  const channelList = channels
    .filter(c => c !== 'Email Marketing')
    .flatMap(c => {
      if (c === 'Google Display') {
        return GOOGLE_DISPLAY_FORMATS.map(gd => `Google Display ${gd.label} (${gd.label}, ${gd.aspectRatio}, ${gd.hint})`);
      }
      const fmt = CHANNEL_FORMATS[c];
      return fmt ? [`${c} (${fmt.label}, ${fmt.aspectRatio})`] : [c];
    }).join('\n');

  const logoInstruction = logoUrl
    ? `\n## REGRA CRÍTICA SOBRE LOGO\nA logo da marca SERÁ adicionada como camada separada após a geração da imagem. Por isso, NÃO inclua nos prompts nenhuma instrução para desenhar, gerar ou renderizar logo, wordmark, nome da marca como elemento gráfico, texto de marca ou símbolo da empresa. Os prompts devem instruir o modelo a deixar a área reservada LIVRE (sem qualquer elemento de identidade visual).`
    : '';

  const layoutInstruction = layoutZones?.length
    ? `\n\n## Layout visual definido pelo usuário — SEGUIR EXATAMENTE nos prompts de imagem:
As posições são em % do banner (x=0%,y=0% = canto superior esquerdo):
${layoutZones.map(z => `- **${z.label}**: x=${Math.round(z.x)}% y=${Math.round(z.y)}%, tamanho ${Math.round(z.w)}% × ${Math.round(z.h)}% do banner`).join('\n')}
Traduza essas proporções em instruções de composição visual nos prompts. Ex: se Headline está em y=28% com h=18%, ele ocupa o terço superior-central do banner.`
    : '';

  const userMessage = `Gere prompts de imagem para os seguintes criativos:

## Dados da marca
- Nome: ${brandName}
- Produto/serviço: ${productService || 'não informado'}
- Paleta de cores: ${colorList}
- Tom: ${tone || 'profissional'}

## REGRA CRÍTICA DE TEXTO NOS BANNERS:
O texto de apoio (supporting text / body / descrição abaixo do headline) deve ter NO MÁXIMO 30 caracteres. Se o texto original for maior, resuma ou omita. Texto longo é cortado pela IA geradora de imagem e fica ilegível. Prefira omitir a incluir texto que vai ser cortado.

## Copies gerados
${copies}
${channelAdaptations ? `\n## Adaptações por canal (use estas copies específicas para cada formato)\n${channelAdaptations}` : ''}
## Formatos necessários (um prompt por formato)
${channelList}${observations ? `\n\n## Regras obrigatórias do cliente (RESPEITAR EM TODOS OS PROMPTS)\n${observations}` : ''}${logoInstruction}${layoutInstruction}`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: skillMd,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].text;
}

// Extrai prompts do output da skill por formato — chave = label (ex: "300×250")
function extractPrompts(skillOutput, formats) {
  const prompts = {};
  for (const fmt of formats) {
    // Google Display: busca pelo label (ex: "300×250"); outros canais: pelo nome do canal
    const searchTerm = fmt.channels[0] === 'Google Display' ? fmt.label : fmt.channels[0];
    const escaped = searchTerm.replace(/[×]/g, '[×x]');
    const blockRe = new RegExp(
      `####[^\\n]*${escaped}[^\\n]*\\n[\\s\\S]*?\\*\\*Prompt:\\*\\*\\s*([\\s\\S]*?)(?=\\n---|\\n####|$)`,
      'i'
    );
    const m = skillOutput.match(blockRe);
    if (m) {
      prompts[fmt.label] = m[1].trim().replace(/^"|"$/g, '');
    }
  }
  return prompts;
}

async function loadLogoAsInlineData(logoUrl) {
  try {
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/png';
      return { inlineData: { data: buf.toString('base64'), mimeType } };
    }
    // fallback local
    const { readFileSync, existsSync } = await import('fs');
    const logoPath = join(__dirname, '../../', logoUrl.replace(/^\//, ''));
    if (!existsSync(logoPath)) return null;
    const ext = logoPath.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
    return { inlineData: { data: readFileSync(logoPath).toString('base64'), mimeType } };
  } catch {
    return null;
  }
}

async function loadLogoBuffer(logoUrl) {
  try {
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      const res = await fetch(logoUrl);
      if (!res.ok) {
        console.warn(`[logo] HTTP ${res.status} ao buscar logo: ${logoUrl}`);
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`[logo] Logo carregada: ${buf.length} bytes de ${logoUrl}`);
      return buf;
    }
    const { readFileSync, existsSync } = await import('fs');
    const logoPath = join(__dirname, '../../', logoUrl.replace(/^\//, ''));
    if (!existsSync(logoPath)) {
      console.warn(`[logo] Arquivo local não encontrado: ${logoPath}`);
      return null;
    }
    return readFileSync(logoPath);
  } catch (err) {
    console.warn(`[logo] Erro ao carregar logo (${logoUrl}):`, err.message);
    return null;
  }
}

// Compõe a logo no banner com posição e inversão de cor configuráveis
async function compositeLogoOnBanner(bannerBuffer, logoUrl, bannerWidth, bannerHeight, { position = 'top', invert = false } = {}) {
  console.log(`[logo] compositeLogoOnBanner: url=${logoUrl} pos=${position} invert=${invert} bannerSize=${bannerWidth}x${bannerHeight}`);
  try {
    let logoRaw = await loadLogoBuffer(logoUrl);
    if (!logoRaw) {
      console.warn('[logo] Logo buffer nulo — banner gerado sem logo');
      return bannerBuffer;
    }

    const maxLogoWidth = Math.min(Math.round(bannerWidth * 0.22), 220);
    const padding = Math.max(16, Math.round(bannerWidth * 0.04));

    let logoSharp = sharp(logoRaw)
      .resize(maxLogoWidth, null, { fit: 'inside', withoutEnlargement: true });

    if (invert) {
      // Inverte canais RGB mantendo o canal alpha intacto
      logoSharp = logoSharp.negate({ alpha: false });
    }

    const logoResized = await logoSharp.png().toBuffer();
    const logoMeta = await sharp(logoResized).metadata();
    const logoH = logoMeta.height || 80;

    const logoW = logoMeta.width || maxLogoWidth;
    const isRight  = position === 'top-right'   || position === 'bottom-right';
    const isCenter = position === 'top-center'  || position === 'bottom-center';
    const isBottom = position === 'bottom'      || position === 'bottom-left' || position === 'bottom-right' || position === 'bottom-center';
    const left = isRight  ? (bannerWidth  || 1080) - logoW - padding
               : isCenter ? Math.round(((bannerWidth  || 1080) - logoW) / 2)
               : padding;
    const top  = isBottom ? (bannerHeight || 1080) - logoH - padding : padding;

    return await sharp(bannerBuffer)
      .composite([{ input: logoResized, top: Math.max(0, top), left: Math.max(0, left), blend: 'over' }])
      .png()
      .toBuffer();
  } catch (err) {
    console.warn('[logo] compositing falhou:', err.message, err.stack?.split('\n')[1]);
    return bannerBuffer;
  }
}

async function getGoogleApiKey() {
  try {
    const res = await pool.query(`SELECT value FROM settings WHERE key = 'google_ai_api_key'`);
    return res.rows[0]?.value || null;
  } catch { return null; }
}

async function getFluxConfig(modelOverride) {
  try {
    const res = await pool.query(`SELECT key, value FROM settings WHERE key IN ('flux_api_key', 'flux_model')`);
    const map = Object.fromEntries(res.rows.map(r => [r.key, r.value]));
    return { apiKey: map.flux_api_key || null, model: modelOverride || map.flux_model || 'flux-pro-1.1' };
  } catch { return { apiKey: null, model: modelOverride || 'flux-pro-1.1' }; }
}

async function getOpenAiKey() {
  try {
    const res = await pool.query(`SELECT value FROM settings WHERE key = 'openai_api_key'`);
    return res.rows[0]?.value || null;
  } catch { return null; }
}

async function getReplicateKey() {
  try {
    const res = await pool.query(`SELECT value FROM settings WHERE key = 'replicate_api_key'`);
    return res.rows[0]?.value || null;
  } catch { return null; }
}

// Mapa de model value → Replicate model id (owner/name)
const REPLICATE_MODEL_MAP = {
  'flux-dev':           'black-forest-labs/flux-dev',
  'flux-pro-1.1':       'black-forest-labs/flux-1.1-pro',
  'flux-pro-1.1-ultra': 'black-forest-labs/flux-1.1-pro-ultra',
  'flux-kontext-pro':   'black-forest-labs/flux-kontext-pro',
  'flux-kontext-max':   'black-forest-labs/flux-kontext-max',
  'flux-schnell':       'black-forest-labs/flux-schnell',
};

function replicateAspectRatio(orientation) {
  if (orientation === 'vertical')     return '9:16';
  if (orientation === 'landscape')    return '16:9';
  if (orientation === 'leaderboard')  return '16:9';
  return '1:1';
}

async function generateImageWithReplicate(prompt, orientation, apiKey, model) {
  const replicateModel = REPLICATE_MODEL_MAP[model] || 'black-forest-labs/flux-1.1-pro';
  const aspect_ratio = replicateAspectRatio(orientation);

  let res;
  try {
    res = await fetch(`https://api.replicate.com/v1/models/${replicateModel}/predictions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Prefer': 'wait' },
      body: JSON.stringify({ input: { prompt, aspect_ratio, output_format: 'png' } }),
    });
  } catch (err) {
    throw new Error(`Replicate conexão falhou: ${err.cause?.message || err.message}`);
  }
  if (!res.ok) throw new Error(`Replicate API error ${res.status}: ${await res.text()}`);

  const prediction = await res.json();

  // Se já completou (Prefer: wait)
  if (prediction.status === 'succeeded' && prediction.output) {
    const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error('Falha ao baixar imagem Replicate');
    return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/png' };
  }
  if (prediction.status === 'failed') throw new Error(`Replicate falhou: ${prediction.error}`);

  // Polling (caso Prefer:wait não funcione ou exceda tempo)
  const pollUrl = prediction.urls?.get;
  if (!pollUrl) throw new Error('Replicate não retornou URL de polling');

  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const poll = await fetch(pollUrl, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    const result = await poll.json();
    if (result.status === 'succeeded' && result.output) {
      const url = Array.isArray(result.output) ? result.output[0] : result.output;
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error('Falha ao baixar imagem Replicate');
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/png' };
    }
    if (result.status === 'failed') throw new Error(`Replicate falhou: ${result.error}`);
  }
  throw new Error('Replicate timeout após 180s');
}

// Tamanhos suportados por modelo:
// gpt-image-2: 1024x1024, 1024x1536, 1536x1024
// gpt-image-1: 1024x1024, 1024x1792, 1792x1024
function openAiSize(orientation, model) {
  const isV2 = model === 'gpt-image-2';
  if (orientation === 'vertical')   return isV2 ? '1024x1536' : '1024x1792';
  if (orientation === 'square')     return '1024x1024';
  return isV2 ? '1536x1024' : '1792x1024'; // landscape e leaderboard
}

async function generateImageWithOpenAI(prompt, orientation, apiKey, model = 'gpt-image-2') {
  const body = {
    model,
    prompt,
    size: openAiSize(orientation, model),
    quality: 'high',
    n: 1,
  };
  // gpt-image-1 não retorna b64 por padrão; gpt-image-2 já retorna b64
  if (model === 'gpt-image-1') body.response_format = 'b64_json';

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI não retornou imagem');
  return { buffer: Buffer.from(b64, 'base64'), mime: 'image/png' };
}

const snap32 = (n) => Math.max(64, Math.round(n / 32) * 32);

async function generateImageWithFlux(prompt, width, height, apiKey, model) {
  const w = snap32(width);
  const h = snap32(height);

  let res;
  try {
    res = await fetch(`https://api.bfl.ai/v1/${model}`, {
      method: 'POST',
      headers: { 'X-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width: w, height: h }),
    });
  } catch (err) {
    throw new Error(`Flux API inacessível (api.bfl.ai): ${err.cause?.message || err.message}`);
  }
  if (!res.ok) throw new Error(`Flux API error ${res.status}: ${await res.text()}`);
  const createData = await res.json();
  const pollingUrl = createData.polling_url;
  if (!pollingUrl) throw new Error('Flux não retornou polling_url');

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const poll = await fetch(pollingUrl, {
      headers: { 'accept': 'application/json', 'x-key': apiKey },
    }).catch(err => { throw new Error(`Flux polling inacessível: ${err.cause?.message || err.message}`); });
    const result = await poll.json();
    if (result.status === 'Ready') {
      const imgRes = await fetch(result.result.sample);
      if (!imgRes.ok) throw new Error('Falha ao baixar imagem Flux');
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/jpeg' };
    }
    if (result.status === 'Error' || result.status === 'Failed') throw new Error(`Flux error: ${JSON.stringify(result)}`);
  }
  throw new Error('Flux timeout após 300s');
}

function parseCopies(copiesText) {
  if (!copiesText) return [];
  // Match any heading level (##, ###, ####) followed by "Criativo N"
  const blocks = copiesText.split(/#{2,6}\s*Criativo\s*\d+/i).slice(1);
  if (!blocks.length) {
    // Fallback: treat entire text as one copy block
    const get = (field) => {
      const m = copiesText.match(new RegExp(`(?:^|\\n)\\**\\s*${field}\\s*\\**\\s*:(.+?)(?=\\n|$)`, 'i'));
      return m ? m[1].trim().replace(/\*+/g, '') : '';
    };
    const titulo = get('titulo') || get('headline') || get('manchete');
    const topo = get('topo') || get('subtítulo') || get('subtitulo');
    const cta = get('cta') || get('call.to.action');
    const texto_central = get('texto_central') || get('texto central') || get('body');
    if (titulo || topo) return [{ topo, titulo, texto_central, cta }];
    return [];
  }
  return blocks.map((block) => {
    const get = (field) => {
      const m = block.match(new RegExp(`-\\s*\\**${field}\\**\\s*:(.+?)(?=\\n-|\\n#|$)`, 'is'));
      return m ? m[1].trim().replace(/\*+/g, '') : '';
    };
    return {
      topo: get('topo'),
      titulo: get('titulo'),
      texto_central: get('texto_central'),
      cta: get('cta'),
    };
  }).filter((c) => c.titulo || c.topo);
}

function buildImagePrompt({ copy, brandName, colors, orientation }) {
  const primaryColor = colors?.[0] || '#1a3a5c';
  const accentColor  = colors?.[2] || colors?.[1] || '#e85d04';

  const layoutHint = orientation === 'vertical'
    ? 'tall vertical layout (9:16 or 1:2), logo area at top, large headline in center, CTA button near bottom'
    : orientation === 'leaderboard'
    ? 'extremely wide horizontal banner (728×90), all elements on a single line: logo far-left, short headline center, CTA button far-right, very compact'
    : orientation === 'landscape'
    ? 'wide horizontal layout (16:9 or 4:3 or 16:5), logo left, headline center-right, CTA button right'
    : 'square layout (1:1), logo top, headline center, CTA button bottom';

  return `Professional marketing banner for brand "${brandName}".

VISUAL DESIGN:
- Layout: ${layoutHint}
- Background: solid ${primaryColor} with subtle texture or gradient
- Accent color (buttons, highlights): ${accentColor}
- Style: modern minimalist, clean geometric shapes, high contrast, no photos, no people

TEXT TO RENDER ON BANNER — copy these strings EXACTLY, character by character, do not translate, do not change spelling:
- Small top label (small caps, ${accentColor}): "${copy.topo || ''}"
- Main headline (very large bold white text): "${copy.titulo || copy.topo}"
- Supporting text (small, 80% white opacity): "${copy.texto_central || ''}"
- CTA button text (${accentColor} rounded button, bold white): "${copy.cta || 'Saiba Mais'}"

IMPORTANT: The texts above are in Brazilian Portuguese. Render them verbatim with correct spelling. Do not translate or modify any word.`;
}

export async function generateBanners({ creativeId, copies, channelAdaptations, channels, brandName, colors, productService, tone, logoUrl, logoPosition = 'top', logoInvert = false, observations, onStep, bannerProvider = 'gemini', fluxModel: fluxModelOverride, openaiModel = 'gpt-image-2', replicateModel: replicateModelOverride, layoutZones }) {
  // Resolve provider credentials
  let geminiApiKey = null;
  let fluxApiKey = null;
  let fluxModel = 'flux-pro-1.1';
  let openAiKey = null;
  let replicateKey = null;

  if (bannerProvider === 'flux') {
    const fluxConfig = await getFluxConfig(fluxModelOverride);
    fluxApiKey = fluxConfig.apiKey;
    fluxModel = fluxConfig.model;
    if (!fluxApiKey) {
      onStep?.('banner-skip', 'Chave Flux não configurada — pulando geração de imagens');
      return { banners: [], errors: [] };
    }
  } else if (bannerProvider === 'replicate') {
    replicateKey = await getReplicateKey();
    fluxModel = replicateModelOverride || 'flux-pro-1.1';
    if (!replicateKey) {
      onStep?.('banner-skip', 'Chave Replicate não configurada — pulando geração de imagens');
      return { banners: [], errors: [] };
    }
  } else if (bannerProvider === 'openai') {
    openAiKey = await getOpenAiKey();
    if (!openAiKey) {
      onStep?.('banner-skip', 'Chave OpenAI não configurada — pulando geração de imagens');
      return { banners: [], errors: [] };
    }
  } else {
    geminiApiKey = await getGoogleApiKey();
    if (!geminiApiKey) {
      onStep?.('banner-skip', 'Nano Banana não configurado — pulando geração de imagens');
      return [];
    }
  }

  if (!channels?.length) return [];

  const formats = getUniqueFormats(channels);
  if (!formats.length) return [];

  const parsedCopies = parseCopies(copies);
  if (!parsedCopies.length) {
    onStep?.('banner-skip', 'Copies não reconhecidas para geração de banners');
    return [];
  }

  // Etapa 9a — Claude refina os prompts via skill image-prompt-builder
  onStep?.('banner-generator', 'Construindo prompts de imagem com IA...');
  let refinedPrompts = {};
  try {
    const skillOutput = await buildPromptsWithSkill({
      copies, channelAdaptations, brandName, colors, productService, tone, channels, observations, logoUrl, bannerProvider, layoutZones,
    });
    refinedPrompts = extractPrompts(skillOutput, formats);
  } catch (err) {
    console.warn('image-prompt-builder falhou, usando prompts padrão:', err.message);
  }

  const geminiModel = geminiApiKey
    ? new GoogleGenerativeAI(geminiApiKey).getGenerativeModel({ model: 'gemini-2.5-flash-image' })
    : null;

  const colorList = typeof colors === 'string'
    ? colors.split(',').map(s => s.trim()).filter(Boolean)
    : (colors || []);

  // Para Gemini: logo como dado multimodal no input; para Flux/OpenAI: composição pós-geração via sharp
  const logoPart = (logoUrl && bannerProvider === 'gemini') ? await loadLogoAsInlineData(logoUrl) : null;
  const useGcs = await isGcsConfigured();

  const colorHex = colorList.slice(0, 4).join(', ');

  // Gera um banner por copy × por formato
  const tasks = [];
  for (let ci = 0; ci < parsedCopies.length; ci++) {
    for (const fmt of formats) {
      tasks.push({ copy: parsedCopies[ci], copyIndex: ci + 1, fmt });
    }
  }

  onStep?.('banner-generator', `Gerando ${tasks.length} banner(s) em paralelo (${parsedCopies.length} criativo(s) × ${formats.length} formato(s))...`);

  const settled = await Promise.allSettled(
    tasks.map(async ({ copy, copyIndex, fmt }) => {
      let prompt = refinedPrompts[fmt.label] || buildImagePrompt({
        copy,
        brandName,
        colors: colorList,
        orientation: fmt.orientation,
      });
      prompt += `\n\n---\nBrand color palette (exact hex codes): ${colorHex}.`;
      prompt += `\n\nTEXT TO RENDER — copy these strings EXACTLY, do NOT translate or change any word (Brazilian Portuguese):
- Top label: "${copy.topo || ''}"
- Main headline: "${copy.titulo || copy.topo || ''}"
- Body: "${copy.texto_central || ''}"
- CTA button: "${copy.cta || 'Saiba Mais'}"`;
      const posLabel = { 'top': 'top-left', 'top-left': 'top-left', 'top-center': 'top-center', 'top-right': 'top-right', 'bottom': 'bottom-left', 'bottom-left': 'bottom-left', 'bottom-center': 'bottom-center', 'bottom-right': 'bottom-right' }[logoPosition] || 'top-left';
      if (logoUrl && bannerProvider !== 'gemini') {
        // Para Flux/OpenAI: logo será composta via sharp pós-geração — proibir qualquer logo na imagem
        prompt += `\n\nCRITICAL — LOGO RULES (mandatory, no exceptions):
- Do NOT draw, render, write, paint or generate any logo, wordmark, brand name, brand text, or company symbol anywhere in the image.
- Do NOT write the brand name "${brandName}" as any text or graphic element.
- Leave the ${posLabel} corner completely clear of any element — this area is reserved for the brand logo overlay.
- Only render the text strings explicitly listed above (headline, body copy, CTA button). Nothing else.`;
      }
      if (logoPart) {
        prompt += `\n\nThe attached image is the brand logo. Place it in the ${posLabel} corner, intact and recognizable${logoInvert ? ', with white/light coloring' : ''}. Do NOT render the brand name "${brandName}" as additional text or draw a second logo anywhere else in the image — only use the attached logo image, placed once at the specified position.`;
      }
      if (observations) prompt += `\n\nMANDATORY client rules (follow without exception):\n${observations}`;

      const fmtW = fmt.width || 1080;
      const fmtH = fmt.height || 1080;

      let imageBuffer, imageMime;
      if (bannerProvider === 'flux') {
        const { buffer, mime } = await Promise.race([
          generateImageWithFlux(prompt, fmtW, fmtH, fluxApiKey, fluxModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 300s')), 300000)),
        ]);
        imageBuffer = buffer; imageMime = mime;
        if (logoUrl) imageBuffer = await compositeLogoOnBanner(imageBuffer, logoUrl, fmtW, fmtH, { position: logoPosition, invert: logoInvert });
        imageMime = 'image/png';
      } else if (bannerProvider === 'replicate') {
        const { buffer, mime } = await Promise.race([
          generateImageWithReplicate(prompt, fmt.orientation, replicateKey, fluxModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 300s')), 300000)),
        ]);
        imageBuffer = buffer; imageMime = mime;
        if (logoUrl) imageBuffer = await compositeLogoOnBanner(imageBuffer, logoUrl, fmtW, fmtH, { position: logoPosition, invert: logoInvert });
        imageMime = 'image/png';
      } else if (bannerProvider === 'openai') {
        const { buffer, mime } = await Promise.race([
          generateImageWithOpenAI(prompt, fmt.orientation, openAiKey, openaiModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 300s')), 300000)),
        ]);
        imageBuffer = buffer; imageMime = mime;
        if (logoUrl) {
          console.log(`[logo] Iniciando compositing OpenAI para formato ${fmt.label}, logoUrl=${logoUrl}`);
          imageBuffer = await compositeLogoOnBanner(imageBuffer, logoUrl, fmtW, fmtH, { position: logoPosition, invert: logoInvert });
        } else {
          console.log(`[logo] logoUrl vazio — sem compositing para formato ${fmt.label}`);
        }
        imageMime = 'image/png';
      } else {
        const contentParts = [{ text: prompt }];
        if (logoPart) contentParts.unshift(logoPart);
        const result = await Promise.race([
          geminiModel.generateContent({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 60s')), 60000)),
        ]);
        const parts = result.response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData?.data);
        if (!imagePart) throw new Error('Nenhuma imagem retornada pelo Gemini');
        imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        imageMime = imagePart.inlineData.mimeType || 'image/png';
      }

      const ext = imageMime.includes('png') ? 'png' : 'jpg';
      const filename = `creative_${creativeId}_c${copyIndex}_${fmt.label.replace(/[×x]/g, 'x')}_${Date.now()}.${ext}`;
      let bannerUrl;
      if (useGcs) bannerUrl = await uploadBannerToGcs(imageBuffer, filename, imageMime);
      if (!bannerUrl) {
        writeFileSync(join(BANNERS_DIR, filename), imageBuffer);
        bannerUrl = `/uploads/banners/${filename}`;
      }

      return {
        url: bannerUrl,
        label: fmt.label,
        copyIndex,
        aspectRatio: fmt.aspectRatio,
        orientation: fmt.orientation,
        channels: fmt.channels,
        titulo: copy.titulo || copy.topo,
        cta: copy.cta,
      };
    })
  );

  const banners = [];
  const errors = [];
  settled.forEach((r, i) => {
    const { copyIndex, fmt } = tasks[i];
    if (r.status === 'fulfilled') {
      banners.push(r.value);
    } else {
      const label = `${fmt.label} Criativo ${copyIndex}`;
      console.error(`Erro banner ${label}:`, r.reason.message);
      errors.push({ label, message: r.reason.message });
      onStep?.('banner-error', `Erro no formato ${label}: ${r.reason.message}`);
    }
  });

  return { banners, errors };
}
