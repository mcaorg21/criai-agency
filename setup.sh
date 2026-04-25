#!/bin/bash
echo "=== Instalando dependências do backend ==="
cd backend && npm install

echo ""
echo "=== Instalando dependências do frontend ==="
cd ../frontend && npm install

echo ""
echo "=== Configurando .env do backend ==="
cd ../backend
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Arquivo .env criado. Edite backend/.env com sua ANTHROPIC_API_KEY."
fi

echo ""
echo "✓ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  1. Edite backend/.env com sua ANTHROPIC_API_KEY e DATABASE_URL"
echo "  2. cd backend && npm run migrate  (criar tabelas no banco)"
echo "  3. Em dois terminais:"
echo "     Terminal 1: cd backend && npm run dev"
echo "     Terminal 2: cd frontend && npm run dev"
echo "  4. Acesse http://localhost:5173"
