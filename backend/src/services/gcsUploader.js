import { Storage } from '@google-cloud/storage';
import pool from '../db/pool.js';

async function getGcsConfig() {
  try {
    const res = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('gcs_bucket_name', 'gcs_key_json')`
    );
    const map = {};
    res.rows.forEach(r => { map[r.key] = r.value; });
    return { bucketName: map.gcs_bucket_name, keyJson: map.gcs_key_json };
  } catch {
    return {};
  }
}

async function upload(buffer, filename, folder, contentType) {
  const { bucketName, keyJson } = await getGcsConfig();
  if (!bucketName || !keyJson) return null;

  const credentials = JSON.parse(keyJson);
  const storage = new Storage({ credentials });
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(`${folder}/${filename}`);

  await file.save(buffer, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000' },
  });

  return `https://storage.googleapis.com/${bucketName}/${folder}/${filename}`;
}

export async function uploadLogoToGcs(buffer, filename, contentType) {
  return upload(buffer, filename, 'logos', contentType);
}

export async function uploadBannerToGcs(buffer, filename, contentType) {
  return upload(buffer, filename, 'banners', contentType);
}

export async function isGcsConfigured() {
  const { bucketName, keyJson } = await getGcsConfig();
  return !!(bucketName && keyJson);
}
