import pool from './pool.js';

const { rows: r1 } = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'creatives' AND column_name = 'banner_provider'
`);
if (r1.length === 0) {
  await pool.query(`ALTER TABLE creatives ADD COLUMN banner_provider VARCHAR(20) DEFAULT 'gemini'`);
  console.log('✓ banner_provider adicionado');
} else {
  console.log('banner_provider já existe');
}

const { rows: r2 } = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'creatives' AND column_name = 'flux_model'
`);
if (r2.length === 0) {
  await pool.query(`ALTER TABLE creatives ADD COLUMN flux_model VARCHAR(50)`);
  console.log('✓ flux_model adicionado');
} else {
  console.log('flux_model já existe');
}

pool.end();
