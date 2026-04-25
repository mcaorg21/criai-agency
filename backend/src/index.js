import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import clientsRouter from './routes/clients.js';
import creativesRouter from './routes/creatives.js';
import brandRouter from './routes/brand.js';
import settingsRouter from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/api/clients', clientsRouter);
app.use('/api/creatives', creativesRouter);
app.use('/api/brand', brandRouter);
app.use('/api/settings', settingsRouter);
app.use('/uploads', express.static(join(dirname(fileURLToPath(import.meta.url)), '../uploads')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Reseta criativos que ficaram presos como "running" (ex: se o servidor caiu durante geração)
import pool from './db/pool.js';
pool.query("UPDATE creatives SET status='error' WHERE status='running'")
  .then(r => { if (r.rowCount) console.log(`${r.rowCount} criativo(s) resetado(s) de running → error`); })
  .catch(() => {});

app.listen(PORT, () => console.log(`Criai backend rodando em http://localhost:${PORT}`));
