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


export async function generateCreative({ client: clientData, brief, onStep, channels, simulateAudience = true, emailOptions = {}, numCopies, layoutZones }) {
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
  const nCopies = numCopies || brief.num_copies || 3;
  onStep?.('display-copy-builder', 'Gerando copies para criativos...');
  results.copies = await runSkill(
    'display-copy-builder',
    `${brandContext}\n${briefContext}\n## Análise da marca\n${results.brandAnalysis}`,
    `Gere exatamente ${nCopies} variação${nCopies > 1 ? 'ões' : ''} de criativo de display com base no briefing e na análise da marca.`
  );

  // Etapa 3 – Formatação visual
  onStep?.('display-creative-formatter', 'Formatando estrutura visual...');
  const layoutInstruction = layoutZones?.length
    ? `\n\n## Layout visual definido pelo usuário — SEGUIR EXATAMENTE:\nO usuário definiu as seguintes zonas com posições e tamanhos em % do banner:\n${layoutZones.map(z => `- **${z.label}**: posição x=${Math.round(z.x)}% y=${Math.round(z.y)}%, tamanho ${Math.round(z.w)}% × ${Math.round(z.h)}% do banner`).join('\n')}\nUse estas proporções para definir a hierarquia e disposição visual de cada elemento.`
    : '';
  results.visualFormat = await runSkill(
    'display-creative-formatter',
    `${brandContext}\n${briefContext}`,
    `Com base nas copies abaixo, defina a estrutura visual de cada criativo:\n\n${results.copies}

## RESTRIÇÕES OBRIGATÓRIAS DE TEXTO — SEGUIR À RISCA:
- Headline: máximo 6 palavras
- Texto central (apoio): MÁXIMO 30 CARACTERES — se não couber, omita. Ex: "A partir de R$49/mês"
- CTA: máximo 4 palavras
- NUNCA escreva mais de 30 caracteres no campo Texto central — esse texto vai direto para geração de imagem e será cortado se for maior${layoutInstruction}`
  );

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

  // Etapa 9 – Posts para redes sociais (apenas se houver canal de mídia social selecionado)
  const SOCIAL_CHANNELS = ['Instagram Feed', 'Instagram Story', 'Facebook Feed', 'Facebook Story', 'TikTok', 'LinkedIn'];
  const hasSocial = channels?.some(c => SOCIAL_CHANNELS.includes(c));
  if (hasSocial) {
    onStep?.('social-post-generator', 'Gerando posts para redes sociais...');
    const socialChannels = channels.filter(c => SOCIAL_CHANNELS.includes(c));
    results.socialPosts = await runSkill(
      'social-post-generator',
      `${brandContext}\n${briefContext}`,
      `Gere posts para as redes sociais selecionadas: ${socialChannels.join(', ')}

## Análise da marca
${results.brandAnalysis}

## Copies principais
${results.copies}

## Copies curtas
${results.shortCopies}

## Adaptações por canal
${results.channelAdaptations}

## Avaliação de performance
${results.performanceEval}
${results.audienceReaction ? `\n## Reação do público\n${results.audienceReaction}` : ''}`,
      { maxTokens: 8096 }
    );
  }

  onStep?.('done', 'Criativo gerado com sucesso!');
  return results;
}
