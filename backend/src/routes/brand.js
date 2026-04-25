import { Router } from 'express';
import { extractColorsFromUrl } from '../services/colorExtractor.js';
import { createWriteStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/pool.js';
import { uploadLogoToGcs } from '../services/gcsUploader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads/logos');
mkdirSync(UPLOADS_DIR, { recursive: true });

const router = Router();

router.get('/extract-colors', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url é obrigatório' });
  try {
    const colors = await extractColorsFromUrl(url);
    res.json({ colors });
  } catch (err) {
    res.status(500).json({ error: `Não foi possível acessar o site: ${err.message}` });
  }
});

router.post('/clients/:id/logo', async (req, res) => {
  const { id } = req.params;
  const label = req.query.label || '';

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'image/png';
  const ext = contentType.includes('png') ? 'png'
    : contentType.includes('svg') ? 'svg'
    : contentType.includes('webp') ? 'webp'
    : 'jpg';

  const filename = `client_${id}_${Date.now()}.${ext}`;
  let logoUrl;

  try {
    const gcsUrl = await uploadLogoToGcs(buffer, filename, contentType);
    if (gcsUrl) {
      logoUrl = gcsUrl;
      console.log(`Logo enviada para GCS: ${gcsUrl}`);
    } else {
      const filepath = join(UPLOADS_DIR, filename);
      await new Promise((resolve, reject) => {
        const ws = createWriteStream(filepath);
        ws.write(buffer);
        ws.end();
        ws.on('finish', resolve);
        ws.on('error', reject);
      });
      logoUrl = `/uploads/logos/${filename}`;
    }
  } catch (err) {
    console.error('Falha no upload GCS, salvando localmente:', err.message);
    const filepath = join(UPLOADS_DIR, filename);
    await new Promise((resolve, reject) => {
      const ws = createWriteStream(filepath);
      ws.write(buffer);
      ws.end();
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    logoUrl = `/uploads/logos/${filename}`;
  }

  const { rows } = await pool.query(
    `INSERT INTO client_logos (client_id, url, label) VALUES ($1, $2, $3) RETURNING id`,
    [id, logoUrl, label]
  );
  const logoId = rows[0].id;

  await pool.query('UPDATE clients SET logo_url=$1, updated_at=NOW() WHERE id=$2', [logoUrl, id]);

  res.json({ logo_url: logoUrl, logo_id: logoId });
});

router.delete('/clients/:id/logos/:logoId', async (req, res) => {
  const { id, logoId } = req.params;

  const { rows } = await pool.query(
    `DELETE FROM client_logos WHERE id=$1 AND client_id=$2 RETURNING url`,
    [logoId, id]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Logo não encontrada' });

  const remaining = await pool.query(
    `SELECT url FROM client_logos WHERE client_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [id]
  );
  await pool.query(
    `UPDATE clients SET logo_url=$1, updated_at=NOW() WHERE id=$2`,
    [remaining.rows[0]?.url || null, id]
  );

  res.json({ ok: true });
});

export default router;
