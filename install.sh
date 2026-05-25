#!/usr/bin/env bash
# =====================================================================
# Instalador automatico para Linux / macOS / WSL. Levanta el stack
# completo en Docker (db + api + web + adminer). Idempotente.
#
# Uso:
#   bash install.sh             # instalar/levantar
#   bash install.sh --reset     # docker compose down -v (BORRA la base)
#   bash install.sh --rebuild   # rebuild sin cache
# =====================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

RESET=0
REBUILD=0
for arg in "$@"; do
    case "$arg" in
        --reset)   RESET=1 ;;
        --rebuild) REBUILD=1 ;;
        -h|--help)
            echo "Uso: bash install.sh [--reset] [--rebuild]"
            exit 0
            ;;
    esac
done

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '    \033[32mOK\033[0m  %s\n' "$1"; }
warn() { printf '    \033[33m!!\033[0m  %s\n' "$1"; }
die()  { printf '\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

step "Repo: $REPO_DIR"

# ---------- 1) Docker -------------------------------------------------
step "Verificando Docker..."
if ! command -v docker >/dev/null 2>&1; then
    echo
    echo "Docker no esta instalado." >&2
    echo "  Linux:  curl -fsSL https://get.docker.com | sudo sh" >&2
    echo "  macOS:  https://www.docker.com/products/docker-desktop/" >&2
    exit 1
fi
ok "docker: $(docker --version)"

if ! docker info >/dev/null 2>&1; then
    die "Docker esta instalado pero el daemon no responde. Arranca Docker Desktop / 'sudo systemctl start docker'."
fi
ok "Docker daemon arriba"

if ! docker compose version >/dev/null 2>&1; then
    die "El plugin 'docker compose' no esta disponible. Actualiza Docker."
fi
ok "compose: $(docker compose version --short)"

# ---------- 2) .env ---------------------------------------------------
step "Verificando .env..."
if [ ! -f .env ]; then
    [ -f .env.example ] || die ".env.example no existe. Repo incompleto."
    cp .env.example .env
    ok ".env creado desde .env.example"
else
    ok ".env ya existe (no lo toco)"
fi

# ---------- 3) Reset opcional ----------------------------------------
if [ "$RESET" -eq 1 ]; then
    step "Reset solicitado: docker compose down -v (BORRA la base!)"
    docker compose down -v || warn "down -v devolvio error, sigo igual"
fi

# ---------- 4) Build + up --------------------------------------------
if [ "$REBUILD" -eq 1 ]; then
    step "Rebuild sin cache..."
    docker compose build --no-cache
fi

step "Levantando stack (esto descarga imagenes la primera vez)..."
docker compose up -d --build

# ---------- 5) Esperar API -------------------------------------------
step "Esperando a que la API responda (max 60s)..."
API_URL='http://localhost:3000/api/v1/health'
READY=0
for _ in $(seq 1 30); do
    if curl -fsS "$API_URL" >/dev/null 2>&1; then READY=1; break; fi
    sleep 2
done
if [ "$READY" -eq 1 ]; then
    ok "API responde en $API_URL"
else
    warn "La API todavia no responde. Revisa con: docker compose logs api"
fi

# ---------- 6) Resumen -----------------------------------------------
cat <<'EOF'

===============================================================
 Stack arriba. URLs:

   Storefront + Admin:  http://localhost:8080
   API:                 http://localhost:3000
   Adminer (DB UI):     http://localhost:8081

 Demo:
   Tienda publica:      http://localhost:8080/t/burger-demo
   Admin login:         http://localhost:8080/admin/login
     tenant_slug:       burger-demo
     email:             admin@burger-demo.test
     password:          admin123

 Comandos utiles:
   docker compose logs -f api    # ver logs en vivo
   docker compose ps             # ver estado
   docker compose down           # apagar (manteniendo DB)
   bash install.sh --reset       # reset total (borra la base)
===============================================================
EOF
