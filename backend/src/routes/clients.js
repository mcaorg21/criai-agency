import { Router } from 'express';
import pool from '../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM clients ORDER BY created_at DESC'
  );
  res.json(result.rows);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });

  const logosResult = await pool.query(
    'SELECT id, url, label, created_at FROM client_logos WHERE client_id=$1 ORDER BY created_at ASC',
    [req.params.id]
  );

  res.json({ ...result.rows[0], logos: logosResult.rows });
});

router.post('/', async (req, res) => {
  const { brand_name, site_url, product_or_service, color_palette } = req.body;
  if (!brand_name) return res.status(400).json({ error: 'brand_name é obrigatório' });

  const result = await pool.query(
    `INSERT INTO clients (brand_name, site_url, product_or_service, color_palette)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [brand_name, site_url, product_or_service, color_palette]
  );
  res.status(201).json(result.rows[0]);
});

router.put('/:id', async (req, res) => {
  const { brand_name, site_url, product_or_service, color_palette } = req.body;
  const result = await pool.query(
    `UPDATE clients SET brand_name=$1, site_url=$2, product_or_service=$3, color_palette=$4, updated_at=NOW()
     WHERE id=$5 RETURNING *`,
    [brand_name, site_url, product_or_service, color_palette, req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(result.rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM clients WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;
