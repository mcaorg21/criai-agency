import Anthropic from '@anthropic-ai/sdk';
import { loadSkill } from './skillLoader.js';
import pool from '../db/pool.js';
import dotenv from 'dotenv';
dotenv.config();

async function getApiKey() {
  try {
    const res = await pool.query(`SELECT value FROM settings WHERE key = 'anthropic_api_key'`);
    if (res.rows[0]?.value) return res.rows[0].value;
  } catch { /* fallback to env */ }
  return process.env.ANTHROPIC_API_KEY;
}

async function getClient() {
  const apiKey = await getApiKey();
  return new Anthropic({ apiKey });
}

const MODEL = 'claude-sonnet-4-6';

async function runSkill(skillName, systemExtra, userMessage, { maxTokens = 4096 } = {}) {
  const skillMd = loadSkill(skillName);
  const system = `${skillMd}\n\n${systemExtra || ''}`.trim();
  const client = await getClient();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].text;
}

// Mapeamento canal → formato de banner (espelha bannerGenerator.js)
const BANNER_CHANNEL_FORMATS = {
  'Instagram Feed':  { label: '1080×1080', width: 1080, height: 1080 },
  'Facebook Feed':   { label: '1080×1080', width: 1080, height: 1080 },
  'Instagram Story': { label: '1080×1920', width: 1080, height: 1920 },
  'Facebook Story':  { label: '1080×1920', width: 1080, height: 1920 },
  'TikTok':          { label: '1080×1920', width: 1080, height: 1920 },
  'YouTube':         { label: '1280×720',  width: 1280, height: 720  },
};

const GOOGLE_DISPLAY_BANNER_FORMATS = [
  { label: '300×250',  width: 300,  height: 250,  hint: 'medium rectangle' },
  { label: '336×280',  width: 336,  height: 280,  hint: 'large rectangle'  },
  { label: '728×90',   width: 728,  height: 90,   hint: 'leaderboard'      },
  { label: '300×600',  width: 300,  height: 600,  hint: 'half page'        },
  { label: '320×100',  width: 320,  height: 100,  hint: 'mobile banner'    },
];

function getBannerFormats(channels) {
  const seen = new Set();
  const formats = [];
  for (const ch of (channels || [])) {
    if (ch === 'Email Marketing') continue;
    if (ch === 'Google Display') {
      for (const gd of GOOGLE_DISPLAY_BANNER_FORMATS) {
        if (!seen.has(gd.label)) {
          seen.add(gd.label);
          formats.push({ channel: `Google Display ${gd.label} (${gd.hint})`, ...gd });
        }
      }
      continue;
    }
    const fmt = BANNER_CHANNEL_FORMATS[ch];
    if (!fmt) continue;
    if (!seen.has(fmt.label)) {
      seen.add(fmt.label);
      formats.push({ channel: ch, ...fmt });
    } else {
      const existing = formats.find(f => f.label === fmt.label);
      if (existing) existing.channel += ` / ${ch}`;
    }
  }
  return formats;
}

export async function generateCreative({ client: clientData, brief, onStep, channels, simulateAudience = true, emailOptions = {} }) {
  const results = {};

  const activeColors = clientData.selected_colors?.length
    ? clientData.selected_colors
    : (clientData.color_palette ? clientData.color_palette.split(',').map(s => s.trim()).filter(Boolean) : []);

  const brandContext = `
## Dados do cliente
- Nome da marca: ${clientData.brand_name}
- Site: ${clientData.site_url}
- Produto/Serviço: ${clientData.product_or_service}
- Paleta de cores completa: ${clientData.color_palette || 'não informada'}
- Cores selecionadas para esta campanha: ${activeColors.length ? activeColors.join(', ') : 'usar paleta completa'}
- Logo da marca: ${clientData.logo_url ? `disponível em ${clientData.logo_url} — usar no header do email HTML e nas peças visuais` : 'não disponível — não incluir logo'}
`;

  const briefContext = `
## Briefing do criativo
- Público-alvo: ${brief.target_audience}
- Objetivo da campanha: ${brief.campaign_objective}
- Oferta principal: ${brief.main_offer}
- Tom desejado: ${brief.desired_tone}
- Canais: ${brief.channels?.join(', ') || 'não informado'}
- Observações: ${brief.observations || 'nenhuma'}
`;

  // Etapa 1 – Brand Reader
  onStep?.('brand-reader', 'Analisando a marca...');
  results.brandAnalysis = await runSkill(
    'brand-reader',
    '',
    `Analise a marca com base nos dados abaixo:\n${brandContext}\n${briefContext}`
  );

  // Etapa 2 – Copy
  onStep?.('display-copy-builder', 'Gerando copies para criativos...');
  results.copies = await runSkill(
    'display-copy-builder',
    `${brandContext}\n${briefContext}\n## Análise da marca\n${results.brandAnalysis}`,
    'Gere copies para os criativos de display com base no briefing e na análise da marca.'
  );

  // Etapa 3 – Formatação visual
  onStep?.('display-creative-formatter', 'Formatando estrutura visual...');
  results.visualFormat = await runSkill(
    'display-creative-formatter',
    `${brandContext}\n${briefContext}`,
    `Com base nas copies abaixo, defina a estrutura visual de cada criativo:\n\n${results.copies}`
  );

  // Etapa 4 – Banner Renderer (templates HTML/CSS por formato — uma call por formato em paralelo)
  onStep?.('display-banner-renderer', 'Criando templates HTML dos banners...');
  const bannerFormats = getBannerFormats(channels);

  const brandColors = {
    primary:    activeColors[0] || '#1a1a2e',
    secondary:  activeColors[1] || '#ffffff',
    accent:     activeColors[2] || activeColors[1] || '#e85d04',
    background: activeColors[3] || activeColors[0] || '#1a1a2e',
  };

  const bannerRendererResults = await Promise.all(
    bannerFormats.map(async (fmt) => {
      const fmtInput = JSON.stringify({
        brand: {
          name:    clientData.brand_name,
          logo_url: clientData.logo_url || null,
          colors:  brandColors,
          font:    'Inter',
        },
        campaign: {
          objective: brief.campaign_objective,
          audience:  brief.target_audience,
          tone:      brief.desired_tone,
        },
        formats: [{ name: `${fmt.channel.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${fmt.width}x${fmt.height}`, width: fmt.width, height: fmt.height }],
      }, null, 2);

      const html = await runSkill(
        'display-banner-renderer',
        `${brandContext}\n${briefContext}`,
        `Gere um template HTML/CSS completo para o formato: ${fmt.channel} ${fmt.label}

## Input
\`\`\`json
${fmtInput}
\`\`\`

## Copies aprovadas (extraia headline, subheadline, description e CTA)
${results.copies}

## Estrutura visual
${results.visualFormat}

## INSTRUÇÕES:
- Retorne APENAS o HTML completo (sem heading, sem explicação, só o bloco \`\`\`html ... \`\`\`)
- width=${fmt.width}px height=${fmt.height}px fixos
- CSS inline ou <style> interno — zero dependências externas
- Textos reais em português extraídos das copies — nunca placeholder`,
        { maxTokens: 4096 }
      );
      return { label: `${fmt.channel} ${fmt.label}`, width: fmt.width, height: fmt.height, html };
    })
  );

  results.bannerRenderer = bannerRendererResults;

  // Etapa 5 – Adaptação por canal
  onStep?.('multi-channel-adapter', 'Adaptando para cada canal...');
  results.channelAdaptations = await runSkill(
    'multi-channel-adapter',
    `${brandContext}\n${briefContext}\nCanais selecionados: ${channels?.join(', ')}`,
    `Adapte os criativos abaixo para os canais selecionados:\n\n${results.copies}`
  );

  // Etapa 6 – Copies curtas
  onStep?.('ad-short-copy-generator', 'Gerando copies curtas otimizadas...');
  results.shortCopies = await runSkill(
    'ad-short-copy-generator',
    `${brandContext}\n${briefContext}`,
    `Gere copies curtas para anúncios com base no briefing e nas copies já criadas:\n\n${results.copies}`
  );

  // Etapa 6 – HTML de email (apenas se email foi selecionado)
  const hasEmail = channels?.some((c) => c.toLowerCase().includes('email'));
  if (hasEmail) {
    onStep?.('email-marketing-html-builder', 'Criando HTML do email marketing...');

    const { unsubscribeFooter = true, utmSource, utmMedium = 'email', utmCampaign } = emailOptions;
    const utmParams = [
      utmSource   ? `utm_source=${encodeURIComponent(utmSource)}`   : null,
      `utm_medium=${encodeURIComponent(utmMedium)}`,
      utmCampaign ? `utm_campaign=${encodeURIComponent(utmCampaign)}` : null,
    ].filter(Boolean).join('&');

    const emailInstructions = `
## Instruções obrigatórias para o email HTML
- Footer de descadastro: ${unsubscribeFooter ? 'INCLUIR obrigatoriamente um rodapé com link de descadastro (ex: "Clique aqui para se descadastrar")' : 'NÃO incluir footer de descadastro'}
- Links dos botões CTA: todos os links dos botões de CTA devem ter os seguintes parâmetros UTM adicionados à URL: ?${utmParams}${!utmSource && !utmCampaign ? '\n  (Preencha source e campaign com valores adequados à marca e campanha)' : ''}
`;

    results.emailHtml = await runSkill(
      'email-marketing-html-builder',
      `${brandContext}\n${briefContext}\n${emailInstructions}`,
      `Crie o HTML completo do email marketing com base no briefing e nas copies:\n\n${results.copies}\n\nFormatação visual:\n${results.visualFormat}\n\nAdaptações por canal (respeite obrigatoriamente as diretrizes de Email Marketing listadas abaixo):\n${results.channelAdaptations}`
    );
  }

  // Etapa 7 – Avaliação de performance
  onStep?.('creative-performance-evaluator', 'Avaliando performance dos criativos...');
  results.performanceEval = await runSkill(
    'creative-performance-evaluator',
    `${brandContext}\n${briefContext}`,
    `Avalie os criativos abaixo:\n\n${results.copies}`
  );

  // Etapa 8 – Simulação de reação do público (opcional)
  if (simulateAudience) {
    onStep?.('audience-reaction-simulator', 'Simulando reação do público...');
    results.audienceReaction = await runSkill(
      'audience-reaction-simulator',
      `${brandContext}\n${briefContext}`,
      `Simule a reação do público "${brief.target_audience}" ao ver os criativos:\n\n${results.copies}`
    );
  }

  onStep?.('done', 'Criativo gerado com sucesso!');
  return results;
}
