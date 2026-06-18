# Deploy en internet — gratis y con HTTPS

Stack: **Oracle Cloud Always Free** (VM Ubuntu, 24 GB RAM, gratis para siempre) + **DuckDNS** (dominio gratis) + **Caddy** (HTTPS automático con Let's Encrypt).

Resultado: tu tienda accesible en `https://tu-nombre.duckdns.org`, con cert SSL válido, sin pagar nada recurrente.

---

## 0. Lo que vas a necesitar

- Tarjeta de crédito para verificar identidad en Oracle (**no cobra**, solo valida).
- Tu repo en GitHub (ya lo tenés).
- 1-2 horas la primera vez.

---

## 1. Crear la VM en Oracle Cloud Always Free

1. Andá a https://www.oracle.com/cloud/free/ y creá cuenta. Elegí la región más cercana (`sa-saopaulo-1` o `sa-bogota-1` para Argentina).
2. En la consola, **Compute → Instances → Create Instance**.
3. Configurá:
   - **Image**: `Canonical Ubuntu 22.04`.
   - **Shape**: cambialo a `Ampere`, elegí `VM.Standard.A1.Flex` y subí los recursos al máximo del Always Free (**4 OCPUs, 24 GB RAM**).
   - **Networking**: dejá la subnet por defecto, **chequeá "Assign public IPv4 address"**.
   - **SSH keys**: subí tu pública (o generala en la consola y bajá la privada).
4. Crear. La VM tarda 30-60 segundos.
5. Copiá la **Public IP** que te aparece.

### Abrir 80 y 443 en la Security List

Oracle bloquea entrada por default. En la consola:

- **Networking → Virtual Cloud Networks → tu VCN → Security Lists → Default**.
- **Add Ingress Rules**:
  - Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80`.
  - Source `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `443`.

---

## 2. DuckDNS — dominio gratis

1. https://www.duckdns.org — entrá con tu cuenta de Google/GitHub.
2. Creá un subdominio: `mitienda` → te queda `mitienda.duckdns.org`.
3. Pegá la **IP pública** de la VM en el campo `current ip` y dale **update ip**.

(Opcional: hay un script para auto-actualizar la IP si te cambia. Para Oracle no hace falta porque la IP es reservada.)

---

## 3. Conectar y bootstrapear la VM

Desde tu PC:

```bash
ssh -i /ruta/a/tu/llave.pem ubuntu@<IP-PUBLICA>
```

Ya adentro:

```bash
git clone https://github.com/lonzofrancisco/PedidosRapidos.git
cd PedidosRapidos
bash deploy/bootstrap.sh
```

El script:
- Instala Docker + plugin compose.
- Abre 80 y 443 en `ufw` e `iptables` (Oracle Ubuntu bloquea por default).
- Te pregunta el dominio (poné `mitienda.duckdns.org`).
- Genera `.env.prod` con `JWT_SECRET` y `POSTGRES_PASSWORD` aleatorios.

**Importante**: si Docker se acaba de instalar, cerrá sesión SSH y volvé a entrar para que tu user tome el grupo `docker`. (O usá `sudo` para los siguientes comandos.)

---

## 4. Levantar el stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

La primera vez tarda 3-5 min (build del API + frontend). Después:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f caddy
```

Caddy va a obtener el cert de Let's Encrypt automáticamente con el primer request. Vas a ver algo como:

```
certificate obtained successfully
```

Cuando aparece eso (~30 segundos), abrí en el navegador:

```
https://mitienda.duckdns.org
```

---

## 5. Acceder a Adminer en producción

Adminer **no está expuesto a internet** — solo escucha en el `localhost` de la VM. Para usarlo desde tu PC, hacé un SSH tunnel:

```bash
ssh -L 8081:localhost:8081 ubuntu@<IP-PUBLICA>
```

Y abrí http://localhost:8081 en tu navegador. Las credenciales son las de `.env.prod`.

---

## 6. Backups de Postgres

Mientras no haya integración de pago real, los pedidos son la data crítica. Setup mínimo de backup diario:

```bash
# En la VM:
sudo mkdir -p /var/backups/pedidos
sudo chown $USER /var/backups/pedidos

# Crear /etc/cron.daily/pedidos-backup con:
sudo tee /etc/cron.daily/pedidos-backup > /dev/null <<'EOF'
#!/bin/bash
set -e
TS=$(date +%Y%m%d-%H%M%S)
docker exec pedidos_db pg_dump -U pedidos pedidos | gzip > /var/backups/pedidos/db-$TS.sql.gz
# Borrar backups mas viejos de 14 dias.
find /var/backups/pedidos -name "db-*.sql.gz" -mtime +14 -delete
EOF
sudo chmod +x /etc/cron.daily/pedidos-backup
```

Para subir los dumps a un object storage externo (Cloudflare R2 / Backblaze B2)
hay un script listo en `deploy/backup.sh` (usa `rclone`):

```bash
# 1) Instalar y configurar rclone una vez (creá un remote, ej "r2"):
sudo apt install -y rclone && rclone config
# 2) Probar el backup a mano:
RCLONE_REMOTE=r2:pedidos-backups bash deploy/backup.sh
# 3) Programarlo a diario:
sudo ln -sf "$PWD/deploy/backup.sh" /etc/cron.daily/pedidos-backup
```

---

## 7. Actualizar el código

Cuando hagas cambios y los pushees a GitHub:

```bash
ssh ubuntu@<IP>
cd PedidosRapidos
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## 8. Después de salir a internet — siguiente lista

- [x] Cobro con Mercado Pago (Checkout Pro) integrado — falta cargar `MP_ACCESS_TOKEN` y `MP_PLAN_PRICE` en `.env.prod`.
- [x] Email transaccional por SMTP integrado — falta cargar `SMTP_*` y `EMAIL_FROM` (Brevo / Gmail / Mailgun).
- [x] Backups offsite con `deploy/backup.sh` — falta configurar `rclone` + el cron.
- [ ] Comprar dominio real (`mitienda.com.ar` ~ARS 1500/año en NIC.ar) y reapuntar Caddyfile.
- [ ] Sentry o similar para enterarte de los 500.
- [ ] Cobro recurrente automático (suscripciones/preapproval de MP) sobre el link mensual actual.

---

## Si algo no funciona

| Síntoma | Causa probable |
|---|---|
| `https://...` no carga, browser dice "no se puede conectar" | Puerto 443 cerrado en Oracle Security List, o iptables bloqueando (correr `bootstrap.sh` de nuevo). |
| Caddy no obtiene cert | DNS del dominio no apunta a la IP, o puerto 80 cerrado. Caddy necesita 80 para HTTP-01 challenge. |
| API tira 500 al loguearse | Probablemente `JWT_SECRET` se quedó en el placeholder. Mirá `docker logs pedidos_api`. |
| `docker compose` dice `permission denied` | Tu user no está en el grupo `docker`. Cerrá SSH y volvé a entrar, o usá `sudo`. |
