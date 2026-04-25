import { readFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import pool from '../db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, '../../uploads/logos');

async function getGcsConfig() {
  const res = await pool.query(
    `SELECT key, value FROM settings WHERE key IN ('gcs_bucket_name', 'gcs_key_json')`
  );
  const map = {};
  res.rows.forEach(r => { map[r.key] = r.value; });
  return { bucketName: map.gcs_bucket_name, keyJson: map.gcs_key_json };
}

async function run() {
  const { bucketName, keyJson } = await getGcsConfig();
  if (!bucketName || !keyJson) {
    console.error('GCS não configurado. Configure bucket e JSON em Configurações primeiro.');
    process.exit(1);
  }

  const credentials = JSON.parse(keyJson);
  const storage = new Storage({ credentials });
  const bucket = storage.bucket(bucketName);

  const { rows: clients } = await pool.query(
    `SELECT id, brand_name, logo_url FROM clients WHERE logo_url LIKE '/uploads/logos/%'`
  );

  if (!clients.length) {
    console.log('Nenhuma logo local encontrada para migrar.');
    process.exit(0);
  }

  console.log(`Migrando ${clients.length} logo(s) para gs://${bucketName}/logos/\n`);

  for (const client of clients) {
    const filename = basename(client.logo_url);
    const localPath = join(UPLOADS_DIR, filename);

    if (!existsSync(localPath)) {
      console.warn(`  ⚠ Arquivo não encontrado localmente: ${localPath} — pulando`);
      continue;
    }

    const buffer = readFileSync(localPath);
    const ext = filename.split('.').pop().toLowerCase();
    const contentType = ext === 'png' ? 'image/png'
      : ext === 'svg' ? 'image/svg+xml'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    process.stdout.write(`  Subindo ${client.brand_name} (${filename})... `);

    const file = bucket.file(`logos/${filename}`);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

    const gcsUrl = `https://storage.googleapis.com/${bucketName}/logos/${filename}`;
    await pool.query(
      `UPDATE clients SET logo_url=$1, updated_at=NOW() WHERE id=$2`,
      [gcsUrl, client.id]
    );

    console.log(`✓ ${gcsUrl}`);
  }

  console.log('\nMigração concluída.');
  process.exit(0);
}

run().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
