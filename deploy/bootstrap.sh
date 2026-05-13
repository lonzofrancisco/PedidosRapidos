#!/usr/bin/env bash
# =====================================================================
# Bootstrap para una VM nueva (Oracle Cloud Always Free, Ubuntu 22.04+).
# Idempotente: podes correrlo varias veces.
#
# Lo que hace:
#   1. Instala Docker + plugin compose.
#   2. Abre los puertos 80 / 443 en ufw e iptables (Oracle Ubuntu trae
#      iptables bloqueando todo por default).
#   3. Si no existe .env.prod, lo crea con JWT_SECRET y POSTGRES_PASSWORD
#      aleatorios y pide el dominio.
#
# Uso:
#   bash deploy/bootstrap.sh
# =====================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "==> Repo: $REPO_DIR"

# ---------- 1) Docker -------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Instalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "==> Docker instalado. Cierra sesion SSH y volve a entrar para que tome el grupo,"
  echo "    o usa 'sudo docker compose ...' por ahora."
else
  echo "==> Docker ya instalado: $(docker --version)"
fi

# Verifica plugin compose (docker compose, no docker-compose).
if ! docker compose version >/dev/null 2>&1 && ! sudo docker compose version >/dev/null 2>&1; then
  echo "==> docker compose plugin no encontrado. Reinstalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
fi

# ---------- 2) Firewall ----------------------------------------------
echo "==> Abriendo puertos 22, 80, 443..."
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 22/tcp  >/dev/null 2>&1 || true
  sudo ufw allow 80/tcp  >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# Oracle Ubuntu trae iptables bloqueando 80/443 por default.
add_iptables_rule() {
  local port=$1
  if ! sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
  fi
}
add_iptables_rule 80 || true
add_iptables_rule 443 || true

if command -v netfilter-persistent >/dev/null 2>&1; then
  sudo netfilter-persistent save >/dev/null 2>&1 || true
fi

# ---------- 3) .env.prod ---------------------------------------------
if [ ! -f .env.prod ]; then
  echo
  echo "==> .env.prod no existe. Creando uno nuevo."
  if [ -t 0 ]; then
    read -p "Dominio publico (ej. mitienda.duckdns.org): " DOMAIN_IN
  else
    DOMAIN_IN="cambiame.duckdns.org"
    echo "    (sin TTY -- dejando DOMAIN=$DOMAIN_IN, editalo despues)"
  fi
  JWT_SECRET=$(openssl rand -hex 32)
  PG_PASS=$(openssl rand -hex 16)
  cat > .env.prod <<EOF
DOMAIN=$DOMAIN_IN
POSTGRES_USER=pedidos
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=pedidos
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=12h
EOF
  chmod 600 .env.prod
  echo "==> .env.prod generado (chmod 600). Secretos aleatorios listos."
else
  echo "==> .env.prod ya existe, no lo toco."
fi

echo
echo "==============================================================="
echo " Listo. Para arrancar el stack:"
echo
echo "   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo
echo " Cuando el dominio apunte a la IP de esta VM, Caddy va a sacar"
echo " automaticamente un cert de Let's Encrypt en el primer request a"
echo " https://\$DOMAIN/."
echo "==============================================================="
