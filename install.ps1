#requires -Version 5.1
# =====================================================================
# Instalador automatico para Windows. Levanta el stack completo en
# Docker (db + api + web + adminer). Idempotente: podes correrlo
# multiples veces sin romper nada.
#
# Uso:
#   .\install.ps1
#
# Si Docker Desktop no esta arrancado, abrilo primero y reintenta.
# =====================================================================
[CmdletBinding()]
param(
    [switch]$Rebuild,    # fuerza --no-cache en el build
    [switch]$Reset       # docker compose down -v (BORRA la base) antes de levantar
)

$ErrorActionPreference = 'Stop'
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoDir

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }

Write-Step "Repo: $RepoDir"

# ---------- 1) Verificar Docker --------------------------------------
Write-Step "Verificando Docker..."
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host ""
    Write-Host "Docker no esta instalado en este sistema." -ForegroundColor Red
    Write-Host "Instalalo desde: https://www.docker.com/products/docker-desktop/"
    Write-Host "Despues abri Docker Desktop, espera a que arranque, y volve a correr este script."
    exit 1
}
Write-Ok ("docker: " + (& docker --version))

try { & docker info --format '{{.ServerVersion}}' 2>$null | Out-Null } catch { }
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker esta instalado pero el daemon no responde." -ForegroundColor Red
    Write-Host "Abri Docker Desktop, espera a que el icono de la bandeja deje de parpadear,"
    Write-Host "y volve a correr este script."
    exit 1
}
Write-Ok "Docker daemon arriba"

try { & docker compose version 2>$null | Out-Null } catch { }
if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose plugin no esta disponible. Actualiza Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Ok ("compose: " + (& docker compose version --short))

# ---------- 2) .env ---------------------------------------------------
Write-Step "Verificando .env..."
$envPath     = Join-Path $RepoDir '.env'
$envExample  = Join-Path $RepoDir '.env.example'
if (-not (Test-Path $envPath)) {
    if (-not (Test-Path $envExample)) {
        Write-Host ".env.example no existe. El repo esta incompleto." -ForegroundColor Red
        exit 1
    }
    Copy-Item $envExample $envPath
    Write-Ok ".env creado desde .env.example"
} else {
    Write-Ok ".env ya existe (no lo toco)"
}

# ---------- 3) Reset opcional ----------------------------------------
if ($Reset) {
    Write-Step "Reset solicitado: docker compose down -v (BORRA la base!)"
    & docker compose down -v
    if ($LASTEXITCODE -ne 0) { Write-Warn2 "down -v devolvio error, sigo igual" }
}

# ---------- 4) Build + up --------------------------------------------
Write-Step "Levantando stack (esto descarga imagenes la primera vez, puede tardar)..."
$buildArgs = @('compose','up','-d','--build')
if ($Rebuild) { $buildArgs = @('compose','build','--no-cache') }
& docker @buildArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose fallo. Revisa el error de arriba." -ForegroundColor Red
    exit 1
}

if ($Rebuild) {
    # Si fue rebuild solo, ahora arrancamos
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# ---------- 5) Esperar a que la API responda -------------------------
Write-Step "Esperando a que la API responda (max 60s)..."
$apiUrl = 'http://localhost:3000/api/v1/health'
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 2 }
}
if ($ready) { Write-Ok "API responde en $apiUrl" }
else        { Write-Warn2 "La API todavia no responde. Revisa con: docker compose logs api" }

# ---------- 6) Resumen final -----------------------------------------
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host " Stack arriba. URLs:" -ForegroundColor Green
Write-Host ""
Write-Host "   Storefront + Admin:  http://localhost:8080"
Write-Host "   API:                 http://localhost:3000"
Write-Host "   Adminer (DB UI):     http://localhost:8081"
Write-Host ""
Write-Host " Demo:"
Write-Host "   Tienda publica:      http://localhost:8080/t/burger-demo"
Write-Host "   Admin login:         http://localhost:8080/admin/login"
Write-Host "     tenant_slug:       burger-demo"
Write-Host "     email:             admin@burger-demo.test"
Write-Host "     password:          admin123"
Write-Host ""
Write-Host " Comandos utiles:"
Write-Host "   docker compose logs -f api      # ver logs en vivo"
Write-Host "   docker compose ps               # ver estado"
Write-Host "   docker compose down             # apagar (manteniendo DB)"
Write-Host "   .\install.ps1 -Reset            # reset total (borra la base)"
Write-Host "===============================================================" -ForegroundColor Green
