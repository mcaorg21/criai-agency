import pool from './pool.js';

try {
  await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`);
  console.log('Coluna logo_url adicionada (ou já existia).');
} catch (err) {
  console.error('Erro:', err.message);
} finally {
  await pool.end();
}
