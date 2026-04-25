-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL,
  site_url VARCHAR(500),
  product_or_service TEXT,
  color_palette VARCHAR(500),
  logo_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criativos
CREATE TABLE IF NOT EXISTS creatives (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  target_audience TEXT,
  campaign_objective TEXT,
  main_offer TEXT,
  desired_tone VARCHAR(500),
  channels TEXT[],
  observations TEXT,
  use_logo BOOLEAN DEFAULT false,
  selected_colors TEXT[],
  simulate_audience BOOLEAN DEFAULT true,
  email_unsubscribe_footer BOOLEAN DEFAULT true,
  email_utm_source VARCHAR(200),
  email_utm_medium VARCHAR(200) DEFAULT 'email',
  email_utm_campaign VARCHAR(200),
  status VARCHAR(50) DEFAULT 'pending',
  result_json JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index para busca por status
CREATE INDEX IF NOT EXISTS creatives_status_idx ON creatives(status);
CREATE INDEX IF NOT EXISTS creatives_client_idx ON creatives(client_id);
