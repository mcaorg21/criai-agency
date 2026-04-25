import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

const ALLOWED_KEYS = ['anthropic_api_key', 'google_ai_api_key', 'gcs_bucket_name', 'gcs_key_json', 'flux_api_key', 'flux_model', 'openai_api_key'];

router.get('/', async (req, res) => {
  const result = await pool.query('SELECT key, value FROM settings');
  // Mask the API key — only return last 4 chars
  const rows = result.rows.map((r) => ({
    key: r.key,
    value: r.key === 'anthropic_api_key' && r.value
      ? '••••••••••••••••••••' + r.value.slice(-4)
      : r.value,
  }));
  res.json(rows);
});

router.put('/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (!ALLOWED_KEYS.includes(key)) return res.status(400).json({ error: 'Chave não permitida' });
  if (!value?.trim()) return res.status(400).json({ error: 'Valor não pode ser vazio' });

  await pool.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value.trim()]
  );
  res.json({ ok: true });
});

export default router;
