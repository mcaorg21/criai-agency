const BASE = '/api';

async function req(method, path, body, { retries = 3, retryDelay = 2000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || res.statusText);
      }
      return res.json();
    } catch (err) {
      lastErr = err;
      // Só retenta em erros de rede (ECONNRESET, Failed to fetch, etc.)
      const isNetwork = err instanceof TypeError;
      if (!isNetwork || attempt === retries) throw err;
      console.warn(`[api] ${method} ${path} falhou (tentativa ${attempt}/${retries}), retentando em ${retryDelay * attempt}ms...`, err.message);
      await new Promise(r => setTimeout(r, retryDelay * attempt));
    }
  }
  throw lastErr;
}

export const api = {
  brand: {
    extractColors: (url) => req('GET', `/brand/extract-colors?url=${encodeURIComponent(url)}`),
    uploadLogo: async (clientId, file, label = '') => {
      const qs = label ? `?label=${encodeURIComponent(label)}` : '';
      const res = await fetch(`/api/brand/clients/${clientId}/logo${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!res.ok) throw new Error('Erro ao fazer upload da logo');
      return res.json();
    },
    deleteLogo: (clientId, logoId) => req('DELETE', `/brand/clients/${clientId}/logos/${logoId}`),
  },
  clients: {
    list: () => req('GET', '/clients'),
    get: (id) => req('GET', `/clients/${id}`),
    create: (data) => req('POST', '/clients', data),
    update: (id, data) => req('PUT', `/clients/${id}`, data),
    delete: (id) => req('DELETE', `/clients/${id}`),
  },
  creatives: {
    list: () => req('GET', '/creatives'),
    get: (id) => req('GET', `/creatives/${id}`),
    create: (data) => req('POST', '/creatives', data),
    update: (id, data) => req('PUT', `/creatives/${id}`, data),
    delete: (id) => req('DELETE', `/creatives/${id}`),
    cancel: (id) => req('POST', `/creatives/${id}/cancel`),
    retry: (id) => req('POST', `/creatives/${id}/retry`),
    duplicate: (id) => req('POST', `/creatives/${id}/duplicate`),
    streamGenerateBanners: (id, onStep, onDone, onError) => {
      const es = new EventSource(`/api/creatives/${id}/generate-banners`);
      es.addEventListener('status', (e) => onStep?.(JSON.parse(e.data)));
      es.addEventListener('done', (e) => {
        es.close();
        onDone?.(JSON.parse(e.data));
      });
      es.addEventListener('error', (e) => {
        const d = e.data ? JSON.parse(e.data) : { message: 'Erro desconhecido' };
        onError?.(d.message);
        es.close();
      });
      return () => es.close();
    },
  },
};
