import { Router } from 'express';
import pool from '../db/pool.js';
import { generateCreative } from '../services/skillRunner.js';
import { generateBanners } from '../services/bannerGenerator.js';

const router = Router();

// Runs generation entirely on the backend — no SSE dependency
async function runGeneration(creativeId) {
  const setStep = (step) =>
    pool.query(`UPDATE creatives SET current_step=$1 WHERE id=$2`, [step, creativeId]).catch(() => {});

  try {
    const { rows } = await pool.query(
      `SELECT c.*, cl.* FROM creatives c JOIN clients cl ON c.client_id = cl.id WHERE c.id = $1`,
      [creativeId]
    );
    const row = rows[0];
    if (!row || row.status === 'running' || row.status === 'done') return;

    await pool.query(`UPDATE creatives SET status='running', current_step='start', updated_at=NOW() WHERE id=$1`, [creativeId]);

    const clientData = {
      brand_name: row.brand_name,
      site_url: row.site_url,
      product_or_service: row.product_or_service,
      color_palette: row.color_palette,
      selected_colors: row.selected_colors?.length ? row.selected_colors : null,
      logo_url: row.use_logo ? (row.selected_logo_url || row.logo_url) : null,
    };

    const brief = {
      _creativeId: creativeId,
      target_audience: row.target_audience,
      campaign_objective: row.campaign_objective,
      main_offer: row.main_offer,
      desired_tone: row.desired_tone,
      channels: row.channels,
      observations: row.observations,
    };

    const results = await generateCreative({
      client: clientData,
      brief,
      channels: row.channels,
      simulateAudience: row.simulate_audience ?? true,
      emailOptions: {
        unsubscribeFooter: row.email_unsubscribe_footer ?? true,
        utmSource: row.email_utm_source || null,
        utmMedium: row.email_utm_medium || 'email',
        utmCampaign: row.email_utm_campaign || null,
      },
      onStep: (step) => setStep(step),
    });

    // Salva criativo como done (sem banners ainda)
    await pool.query(
      `UPDATE creatives SET status='done', current_step='done', result_json=$1, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify({ ...results, banners: null }), creativeId]
    );

    console.log(`Criativo ${creativeId} gerado com sucesso. Iniciando banners em background...`);

    // Banners em background separado — não bloqueia nem afeta o status do criativo
    runBannerGeneration(creativeId, results, row);
  } catch (err) {
    console.error(`Erro ao gerar criativo ${creativeId}:`, err.message);
    await pool.query(
      `UPDATE creatives SET status='error', updated_at=NOW() WHERE id=$1`,
      [creativeId]
    ).catch(() => {});
  }
}

async function runBannerGeneration(creativeId, results, row) {
  try {
    const activeColors = row.selected_colors?.length
      ? row.selected_colors
      : (row.color_palette ? row.color_palette.split(',').map(s => s.trim()).filter(Boolean) : []);

    const banners = await generateBanners({
      creativeId,
      copies: results.copies,
      channelAdaptations: results.channelAdaptations,
      channels: row.channels,
      brandName: row.brand_name,
      colors: activeColors.length ? activeColors : row.color_palette,
      productService: row.product_or_service,
      tone: row.desired_tone,
      logoUrl: row.use_logo ? (row.selected_logo_url || row.logo_url) : null,
      observations: row.observations || null,
      bannerProvider: row.banner_provider || 'gemini',
      fluxModel: row.flux_model || null,
      openaiModel: row.openai_model || 'gpt-image-2',
    });

    const current = await pool.query('SELECT result_json FROM creatives WHERE id=$1', [creativeId]);
    const updated = { ...(current.rows[0]?.result_json || {}), banners };
    await pool.query(
      `UPDATE creatives SET result_json=$1, updated_at=NOW() WHERE id=$2`,
      [JSON.stringify(updated), creativeId]
    );
    console.log(`Banners do criativo ${creativeId} gerados: ${banners.length}`);
  } catch (err) {
    console.error(`Erro ao gerar banners do criativo ${creativeId}:`, err.message);
    // Marca banners como [] para indicar que falhou (não null)
    const current = await pool.query('SELECT result_json FROM creatives WHERE id=$1', [creativeId]);
    const updated = { ...(current.rows[0]?.result_json || {}), banners: [] };
    await pool.query(`UPDATE creatives SET result_json=$1 WHERE id=$2`, [JSON.stringify(updated), creativeId]);
  }
}

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, cl.brand_name FROM creatives c
     JOIN clients cl ON c.client_id = cl.id
     ORDER BY c.created_at DESC`
  );
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, cl.brand_name, cl.color_palette, cl.logo_url FROM creatives c
     JOIN clients cl ON c.client_id = cl.id
     WHERE c.id = $1`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Criativo não encontrado' });
  res.json(result.rows[0]);
});

router.post('/:id/duplicate', async (req, res) => {
  const src = await pool.query('SELECT * FROM creatives WHERE id=$1', [req.params.id]);
  if (!src.rows[0]) return res.status(404).json({ error: 'Não encontrado' });
  const c = src.rows[0];
  const result = await pool.query(
    `INSERT INTO creatives (client_id, target_audience, campaign_objective, main_offer, desired_tone, channels, observations)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [c.client_id, c.target_audience, c.campaign_objective, c.main_offer, c.desired_tone, c.channels, c.observations]
  );
  res.status(201).json(result.rows[0]);
});

// SSE endpoint – gera apenas os banners de um criativo já concluído
router.get('/:id/generate-banners', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { rows } = await pool.query(
      `SELECT c.*, cl.brand_name, cl.color_palette, cl.product_or_service, cl.logo_url FROM creatives c
       JOIN clients cl ON c.client_id = cl.id WHERE c.id = $1`,
      [req.params.id]
    );
    const row = rows[0];
    if (!row) { send('error', { message: 'Criativo não encontrado' }); return res.end(); }
    if (!row.result_json) { send('error', { message: 'Gere o criativo completo antes de gerar banners' }); return res.end(); }

    send('status', { step: 'banner-generator', message: 'Iniciando geração de banners...' });

    const { generateBanners } = await import('../services/bannerGenerator.js');
    const banners = await Promise.race([
      generateBanners({
        creativeId: req.params.id,
        copies: row.result_json.copies,
        channels: row.channels,
        brandName: row.brand_name,
        colors: row.selected_colors?.length ? row.selected_colors : row.color_palette,
        productService: row.product_or_service,
        tone: row.desired_tone,
        logoUrl: row.use_logo ? (row.selected_logo_url || row.logo_url) : null,
        observations: row.observations || null,
        bannerProvider: row.banner_provider || 'gemini',
        fluxModel: row.flux_model || null,
        openaiModel: row.openai_model || 'gpt-image-2',
        onStep: (step, message) => send('status', { step, message }),
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na geração de banners')), 180000)),
    ]);

    const updated = { ...row.result_json, banners };
    await pool.query(`UPDATE creatives SET result_json=$1, updated_at=NOW() WHERE id=$2`, [JSON.stringify(updated), req.params.id]);

    send('done', { banners });
  } catch (err) {
    console.error(err);
    send('error', { message: err.message });
  } finally {
    res.end();
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM creatives WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/retry', async (req, res) => {
  const { rows } = await pool.query('SELECT status FROM creatives WHERE id=$1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Não encontrado' });
  if (rows[0].status === 'running') return res.status(400).json({ error: 'Já está gerando' });

  await pool.query(
    `UPDATE creatives SET status='pending', current_step=NULL, result_json=NULL, updated_at=NOW() WHERE id=$1`,
    [req.params.id]
  );
  res.json({ ok: true });
  runGeneration(req.params.id);
});

router.post('/:id/cancel', async (req, res) => {
  await pool.query(
    `UPDATE creatives SET status='cancelled', updated_at=NOW() WHERE id=$1`,
    [req.params.id]
  );
  res.json({ ok: true });
});

router.put('/:id', async (req, res) => {
  const { target_audience, campaign_objective, main_offer, desired_tone, channels, observations, use_logo, selected_colors, selected_logo_url, simulate_audience, email_unsubscribe_footer, email_utm_source, email_utm_medium, email_utm_campaign, banner_provider, flux_model, openai_model } = req.body;
  try {
    const result = await pool.query(
      `UPDATE creatives SET target_audience=$1, campaign_objective=$2, main_offer=$3,
       desired_tone=$4, channels=$5, observations=$6, use_logo=$7, selected_colors=$8,
       simulate_audience=$9, email_unsubscribe_footer=$10, email_utm_source=$11,
       email_utm_medium=$12, email_utm_campaign=$13, selected_logo_url=$14,
       banner_provider=$15, flux_model=$16, openai_model=$17, status='pending', result_json=NULL, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [target_audience, campaign_objective, main_offer, desired_tone, channels, observations, use_logo ?? false, selected_colors || null, simulate_audience ?? true, email_unsubscribe_footer ?? true, email_utm_source || null, email_utm_medium || 'email', email_utm_campaign || null, selected_logo_url || null, banner_provider || 'gemini', flux_model || null, openai_model || 'gpt-image-2', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Criativo não encontrado' });
    res.json(result.rows[0]);
    runGeneration(req.params.id);
  } catch (err) {
    console.error('PUT /creatives/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { client_id, target_audience, campaign_objective, main_offer, desired_tone, channels, observations, use_logo, selected_colors, selected_logo_url, simulate_audience, email_unsubscribe_footer, email_utm_source, email_utm_medium, email_utm_campaign, banner_provider, flux_model, openai_model } = req.body;
  if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório' });

  try {
    const result = await pool.query(
      `INSERT INTO creatives (client_id, target_audience, campaign_objective, main_offer, desired_tone, channels, observations, use_logo, selected_colors, selected_logo_url, simulate_audience, email_unsubscribe_footer, email_utm_source, email_utm_medium, email_utm_campaign, banner_provider, flux_model, openai_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [client_id, target_audience, campaign_objective, main_offer, desired_tone, channels, observations, use_logo ?? false, selected_colors || null, selected_logo_url || null, simulate_audience ?? true, email_unsubscribe_footer ?? true, email_utm_source || null, email_utm_medium || 'email', email_utm_campaign || null, banner_provider || 'gemini', flux_model || null, openai_model || 'gpt-image-2']
    );
    const creative = result.rows[0];
    res.status(201).json(creative);
    runGeneration(creative.id);
  } catch (err) {
    console.error('POST /creatives error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
