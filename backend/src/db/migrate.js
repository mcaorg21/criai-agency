import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Migração concluída com sucesso.');
} catch (err) {
  console.error('Erro na migração:', err.message);
} finally {
  await pool.end();
}
