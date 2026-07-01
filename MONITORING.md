# Monitoring con Grafana + Loki

Logging centralizado y dashboards para monitoreo en tiempo real.

## Acceso

- **Grafana**: http://localhost:3000
  - Usuario: `admin`
  - Contraseña: `admin` (cambiar en `.env` con `GRAFANA_PASSWORD`)

- **Loki**: http://localhost:3100 (interno, no UI)

## Dashboards

### 📊 Pedidos Rápidos - Logging (Auto-cargado)
- **Errores 🔴**: Todos los errores de las últimas 24h
- **HTTP 500+ ⚠️**: Requests que fallaron en servidor
- **Todos los Logs 📋**: Búsqueda general con filtros
- **Auth 🔐**: Logs de login, password reset, etc.

## Búsqueda de Logs

Ejemplos de queries LogQL que puedes usar en Grafana:

```logql
# Errores
{job="api"} | json | level="error"

# Errores HTTP 500+
{job="api"} | json | status_code=~"5.."

# Logs de un tenant específico
{job="api"} | json | tenant_id="abc-123"

# Login attempts
{job="api"} | json | message=~".*login.*|.*auth.*"

# Errores de database
{job="api"} | json | message=~".*database.*|.*pg.*" | level="error"

# En los últimos 30 minutos
{job="api"} | json | level="error" 
```

## Campos de Log

Cada log JSON incluye:
- `timestamp`: Hora ISO 8601
- `level`: debug, info, warn, error
- `message`: Mensaje principal
- `method`: HTTP method (GET, POST, etc.)
- `path`: URL path
- `ip`: IP del cliente
- `tenant_id`: ID del tenant (multi-tenant)
- `user_id`: ID del usuario
- `status_code`: HTTP status
- `stack`: Stack trace (si es error)
- `raw`: Args originales del console.log/error

## Configuración

### Docker

```yaml
# docker-compose.yml ya incluye:
- loki:3100 (backend de logs)
- grafana:3000 (UI)
- datasource Loki pre-configurado
- dashboard auto-cargado
```

### Variables de entorno

```bash
LOKI_HOST=http://loki:3100    # URL de Loki
LOKI_USER=                    # Usuario (si auth está activado)
LOKI_PASS=                    # Contraseña (si auth está activado)
LOG_LEVEL=info                # debug, info, warn, error
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin        # Cambiar en producción
```

## Uso

### Ver errores en tiempo real

1. Abre http://localhost:3000
2. Ve a Dashboards > "Pedidos Rápidos - Logging"
3. Mira el panel "Errores (Últimas 24h)"
4. Clicks en un log para ver detalles completos

### Buscar logs específicos

1. En Grafana, abre el "Explore" (icono de brújula)
2. Selecciona datasource "Loki"
3. Escribe tu query LogQL
4. Ejemplo: `{job="api"} | json | level="error"`

### Crear alertas

1. Edita el dashboard
2. Click en un panel > "Alert" tab
3. Define condición (ej: `count > 0` de errores)
4. Configura notificación (email, Slack, etc.)

## Producción

### En tu servidor

```bash
# 1. Asegúrate que Loki está accesible:
LOKI_HOST=https://logs.tudominio.com:3100

# 2. Protege Grafana con contraseña fuerte:
GRAFANA_PASSWORD=contraseña_muy_segura

# 3. (Opcional) Activar autenticación en Loki:
LOKI_USER=admin
LOKI_PASS=contraseña_segura
```

### Retención de logs

Por defecto, Loki retiene 72 horas. Para cambiar, edita `etc/loki/loki-config.yml`:

```yaml
limits_config:
  retention_period: 720h  # 30 días
```

## Solución de Problemas

### "No data" en Grafana

1. Verifica que Loki está corriendo:
   ```bash
   docker compose ps
   ```

2. Verifica logs del API:
   ```bash
   docker compose logs pedidos_api | tail -20
   ```

3. Verifica que hay datos en Loki:
   - Ve a Grafana > Explore > Loki
   - Query: `{job="api"}`
   - Si nada aparece, el API quizá no está enviando logs

### API no envía logs a Loki

1. Verifica que `LOKI_HOST` está correcto en `.env`
2. Reinicia el API: `docker compose restart pedidos_api`
3. Chequea logs: `docker compose logs pedidos_api | grep -i loki`

### Grafana lento

Loki puede tardar si hay muchos logs. Opciones:
- Filtrar por rango de tiempo más corto
- Usar queries más específicos
- Aumentar `retention_period` solo si necesario

## Costo

- **Grafana**: Gratuito (community edition)
- **Loki**: Gratuito (self-hosted)
- **Almacenamiento**: Usa disk local en `pedidos_loki:/loki`
- **En producción**: ~500MB por semana (depende del tráfico)

## Limpieza de logs antiguos

Loki auto-expira logs basado en `retention_period`. Para limpiar manualmente:

```bash
# Remover volumen de Loki (⚠️ borra TODOS los logs)
docker compose down
docker volume rm pedidos_loki
docker compose up -d
```
