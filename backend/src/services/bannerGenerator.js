import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

async function buildPromptsWithSkill({ copies, channelAdaptations, brandName, colors, productService, tone, channels, observations }) {
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

  const userMessage = `Gere prompts de imagem para os seguintes criativos:

## Dados da marca
- Nome: ${brandName}
- Produto/serviço: ${productService || 'não informado'}
- Paleta de cores: ${colorList}
- Tom: ${tone || 'profissional'}

## Copies gerados
${copies}
${channelAdaptations ? `\n## Adaptações por canal (use estas copies específicas para cada formato)\n${channelAdaptations}` : ''}
## Formatos necessários (um prompt por formato)
${channelList}${observations ? `\n\n## Regras obrigatórias do cliente (RESPEITAR EM TODOS OS PROMPTS)\n${observations}` : ''}`;

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

// OpenAI gpt-image-1 suporta apenas 3 tamanhos fixos — mapeia pelo aspect ratio
function openAiSize(orientation) {
  if (orientation === 'vertical') return '1024x1536';
  if (orientation === 'square')   return '1024x1024';
  return '1536x1024'; // landscape e leaderboard
}

async function generateImageWithOpenAI(prompt, orientation, apiKey, model = 'gpt-image-2') {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      size: openAiSize(orientation),
      quality: 'high',
      n: 1,
    }),
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

  const res = await fetch(`https://api.bfl.ml/v1/${model}`, {
    method: 'POST',
    headers: { 'X-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width: w, height: h }),
  });
  if (!res.ok) throw new Error(`Flux API error ${res.status}: ${await res.text()}`);
  const { id } = await res.json();

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`, {
      headers: { 'X-Key': apiKey },
    });
    const result = await poll.json();
    if (result.status === 'Ready') {
      const imgRes = await fetch(result.result.sample);
      if (!imgRes.ok) throw new Error('Falha ao baixar imagem Flux');
      return { buffer: Buffer.from(await imgRes.arrayBuffer()), mime: 'image/jpeg' };
    }
    if (result.status === 'Error') throw new Error(`Flux error: ${JSON.stringify(result)}`);
  }
  throw new Error('Flux timeout após 120s');
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
- Supporting text (small, 80% white opacity): "${(copy.texto_central || '').slice(0, 80)}"
- CTA button text (${accentColor} rounded button, bold white): "${copy.cta || 'Saiba Mais'}"

IMPORTANT: The texts above are in Brazilian Portuguese. Render them verbatim with correct spelling. Do not translate or modify any word.`;
}

export async function generateBanners({ creativeId, copies, channelAdaptations, channels, brandName, colors, productService, tone, logoUrl, observations, onStep, bannerProvider = 'gemini', fluxModel: fluxModelOverride, openaiModel = 'gpt-image-2' }) {
  // Resolve provider credentials
  let geminiApiKey = null;
  let fluxApiKey = null;
  let fluxModel = 'flux-pro-1.1';
  let openAiKey = null;

  if (bannerProvider === 'flux') {
    const fluxConfig = await getFluxConfig(fluxModelOverride);
    fluxApiKey = fluxConfig.apiKey;
    fluxModel = fluxConfig.model;
    if (!fluxApiKey) {
      onStep?.('banner-skip', 'Chave Flux não configurada — pulando geração de imagens');
      return [];
    }
  } else if (bannerProvider === 'openai') {
    openAiKey = await getOpenAiKey();
    if (!openAiKey) {
      onStep?.('banner-skip', 'Chave OpenAI não configurada — pulando geração de imagens');
      return [];
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
      copies, channelAdaptations, brandName, colors, productService, tone, channels, observations,
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

  // Prepara logo inline se disponível (só relevante para Gemini)
  const logoPart = (logoUrl && bannerProvider === 'gemini') ? await loadLogoAsInlineData(logoUrl) : null;
  const useGcs = await isGcsConfigured();

  const banners = [];
  const copyVariation = parsedCopies[0];
  const total = formats.length;

  for (let i = 0; i < total; i++) {
    const fmt = formats[i];
    onStep?.('banner-generator', `Gerando banner ${i + 1}/${total} — ${fmt.label} (${fmt.channels.join(', ')})`);

    let prompt = refinedPrompts[fmt.label] || buildImagePrompt({
      copy: copyVariation,
      brandName,
      colors: colorList,
      orientation: fmt.orientation,
    });

    const colorHex = colorList.slice(0, 4).join(', ');
    prompt += `\n\n---\nBrand color palette (exact hex codes): ${colorHex}.`;
    prompt += `\n\nTEXT TO RENDER — copy these strings EXACTLY, do NOT translate or change any word (Brazilian Portuguese):
- Top label: "${copyVariation.topo || ''}"
- Main headline: "${copyVariation.titulo || copyVariation.topo || ''}"
- Body: "${(copyVariation.texto_central || '').slice(0, 80)}"
- CTA button: "${copyVariation.cta || 'Saiba Mais'}"`;

    if (logoPart) prompt += `\n\nThe attached image is the brand logo. Place it in the top-left corner, intact and recognizable.`;
    if (observations) prompt += `\n\nMANDATORY client rules (follow without exception):\n${observations}`;

    try {
      let imageBuffer, imageMime;

      if (bannerProvider === 'flux') {
        const { buffer, mime } = await Promise.race([
          generateImageWithFlux(prompt, fmt.width || 1080, fmt.height || 1080, fluxApiKey, fluxModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 120s')), 120000)),
        ]);
        imageBuffer = buffer;
        imageMime = mime;
      } else if (bannerProvider === 'openai') {
        const { buffer, mime } = await Promise.race([
          generateImageWithOpenAI(prompt, fmt.orientation, openAiKey, openaiModel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout após 120s')), 120000)),
        ]);
        imageBuffer = buffer;
        imageMime = mime;
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
        if (!imagePart) {
          console.warn(`Banner ${fmt.label}: nenhuma imagem retornada pelo Gemini`);
          continue;
        }
        imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
        imageMime = imagePart.inlineData.mimeType || 'image/png';
      }

      const ext = imageMime.includes('png') ? 'png' : 'jpg';
      const filename = `creative_${creativeId}_${fmt.orientation}_${Date.now()}.${ext}`;

      let bannerUrl;
      if (useGcs) bannerUrl = await uploadBannerToGcs(imageBuffer, filename, imageMime);
      if (!bannerUrl) {
        writeFileSync(join(BANNERS_DIR, filename), imageBuffer);
        bannerUrl = `/uploads/banners/${filename}`;
      }

      banners.push({
        url: bannerUrl,
        label: fmt.label,
        aspectRatio: fmt.aspectRatio,
        orientation: fmt.orientation,
        channels: fmt.channels,
        titulo: copyVariation.titulo || copyVariation.topo,
        cta: copyVariation.cta,
      });
    } catch (err) {
      console.error(`Erro banner ${fmt.label}:`, err.message);
      onStep?.('banner-error', `Erro no formato ${fmt.label}: ${err.message}`);
    }
  }

  return banners;
}
