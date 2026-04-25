import pool from './pool.js';

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS client_logos (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      url VARCHAR(500) NOT NULL,
      label VARCHAR(255) DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS client_logos_client_idx ON client_logos(client_id);
    ALTER TABLE creatives ADD COLUMN IF NOT EXISTS selected_logo_url VARCHAR(500);
  `);

  const { rows } = await pool.query(
    `SELECT id, logo_url FROM clients WHERE logo_url IS NOT NULL AND logo_url != ''`
  );

  for (const r of rows) {
    const exists = await pool.query(
      `SELECT 1 FROM client_logos WHERE client_id=$1 AND url=$2`,
      [r.id, r.logo_url]
    );
    if (!exists.rows[0]) {
      await pool.query(
        `INSERT INTO client_logos (client_id, url, label) VALUES ($1, $2, '')`,
        [r.id, r.logo_url]
      );
    }
  }

  console.log(`Migração client_logos concluída. ${rows.length} logo(s) migrada(s).`);
} catch (err) {
  console.error('Erro:', err.message);
} finally {
  await pool.end();
}
