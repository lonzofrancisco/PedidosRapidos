# Pedidos Rapidos

SaaS multi-tenant de pedidos para tiendas (comida, ferreteria, etc.).
Backend Node.js + Express + PostgreSQL, listo para correr con Docker.

- **Multi-tenant** por `tenant_id` en todas las tablas, resuelto por slug en URL publica o por JWT en el panel admin.
- **Productos con opciones dinamicas (cards):** grupos `single`/`multi`, con `required`, `min_select`, `max_select` y `price_delta` por opcion.
- **Pedidos sin login** para el cliente final. Datos del cliente se guardan dentro del propio pedido.
- **Panel admin con JWT** para gestionar productos y pedidos (estado).
- **Generacion de pedido para WhatsApp** via deeplink `wa.me`.

---

## Estructura

```
.
|- docker-compose.yml         # Postgres + API
|- Dockerfile
|- .env.example
|- db/
|  |- 01_schema.sql           # esquema multi-tenant
|  '- 02_seed.sql             # tenant demo + admin + productos
|- src/
   |- index.js                # entrypoint
   |- app.js                  # express app
   |- routes.js               # arbol de rutas /api/v1
   |- config/
   |  |- env.js               # carga y valida envs
   |  '- db.js                # pool pg + withTransaction()
   |- middleware/
   |  |- tenant.js            # resuelve tenant por slug
   |  |- auth.js              # JWT + roles
   |  |- validate.js          # validacion con Zod
   |  '- error.js             # error handler global
   |- modules/
   |  |- auth/                # login admin
   |  |- products/            # storefront publico + CRUD admin
   |  '- orders/              # creacion publica + gestion admin
   '- utils/
      |- whatsapp.js          # builder de deeplink wa.me
      |- shortCode.js
      |- asyncHandler.js
      '- httpError.js
```

---

## Quickstart con Docker

```bash
cp .env.example .env
docker compose up --build
```

La API queda en `http://localhost:3000`. Postgres carga `db/*.sql` solo en la primera creacion del volumen, asi que el tenant demo y el admin se crean automaticamente.

Healthcheck: `GET http://localhost:3000/api/v1/health`

### Reset desde cero

```bash
docker compose down -v
docker compose up --build
```

---

## Datos de demo

Tenant: **`burger-demo`**

Admin:

- email: `admin@burger-demo.test`
- password: `admin123`

---

## API REST

Base URL: `/api/v1`

### Publico (storefront, sin auth)

| Metodo | Path | Descripcion |
|---|---|---|
| GET | `/t/:tenantSlug/products` | Catalogo activo con grupos y opciones |
| GET | `/t/:tenantSlug/products/:id` | Detalle de un producto |
| POST | `/t/:tenantSlug/orders` | Crear pedido (devuelve link WhatsApp) |
| GET | `/t/:tenantSlug/orders/:id` | Consultar estado de un pedido |

### Admin (JWT)

| Metodo | Path | Descripcion |
|---|---|---|
| POST | `/auth/login` | `{ tenant_slug, email, password }` -> `{ token, user }` |
| GET | `/admin/products` | Lista todos (incluye inactivos) |
| POST | `/admin/products` | Crea producto + grupos + opciones |
| PATCH | `/admin/products/:id` | Actualiza campos del producto |
| DELETE | `/admin/products/:id` | Borra producto |
| GET | `/admin/orders?status=pending&limit=50` | Lista pedidos del tenant |
| GET | `/admin/orders/:id` | Detalle (con items y opciones) |
| PATCH | `/admin/orders/:id/status` | `{ status: 'confirmed'\|'preparing'\|... }` |

Todas las rutas admin requieren `Authorization: Bearer <token>`.

---

## Flujo de creacion de pedido (ejemplo)

### 1. Listar catalogo

```bash
curl http://localhost:3000/api/v1/t/burger-demo/products
```

Respuesta (recortada):

```json
{
  "tenant": { "slug": "burger-demo", "name": "Burger Demo", "currency": "MXN" },
  "products": [
    {
      "id": "PRODUCT_UUID",
      "name": "Hamburguesa Clasica",
      "price": "120.00",
      "option_groups": [
        {
          "id": "GROUP_UUID",
          "name": "Tamano",
          "type": "single",
          "required": true,
          "min_select": 1,
          "max_select": 1,
          "options": [
            { "id": "OPT_SENCILLA_UUID", "name": "Sencilla", "price_delta": "0.00" },
            { "id": "OPT_DOBLE_UUID",    "name": "Doble",    "price_delta": "35.00" }
          ]
        },
        {
          "name": "Extras",
          "type": "multi",
          "required": false,
          "max_select": 5,
          "options": [
            { "id": "OPT_TOCINO_UUID",   "name": "Tocino",      "price_delta": "15.00" },
            { "id": "OPT_AGUACATE_UUID", "name": "Aguacate",    "price_delta": "12.00" }
          ]
        }
      ]
    }
  ]
}
```

### 2. Crear pedido

```bash
curl -X POST http://localhost:3000/api/v1/t/burger-demo/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customer": {
      "name": "Juan Perez",
      "phone": "5215598765432",
      "address": "Av Reforma 123, CDMX"
    },
    "items": [
      {
        "product_id": "PRODUCT_UUID",
        "quantity": 2,
        "option_ids": ["OPT_DOBLE_UUID", "OPT_TOCINO_UUID"],
        "notes": "sin cebolla"
      }
    ]
  }'
```

Respuesta:

```json
{
  "order": {
    "id": "ORDER_UUID",
    "short_code": "K7HQ29",
    "status": "pending",
    "total": "340.00",
    "currency": "MXN",
    "items": [
      {
        "product_name": "Hamburguesa Clasica",
        "unit_price": 170,
        "quantity": 2,
        "subtotal": 340,
        "options": [
          { "group_name": "Tamano", "option_name": "Doble",  "price_delta": 35 },
          { "group_name": "Extras", "option_name": "Tocino", "price_delta": 15 }
        ]
      }
    ]
  },
  "whatsappUrl": "https://wa.me/5215512345678?text=*Nuevo%20pedido%20%23K7HQ29*..."
}
```

> El precio se recalcula **siempre en el servidor** a partir de la BD. El cliente nunca decide cuanto cuesta el pedido.

### 3. Login admin y avanzar el estado

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"tenant_slug":"burger-demo","email":"admin@burger-demo.test","password":"admin123"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X PATCH http://localhost:3000/api/v1/admin/orders/ORDER_UUID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"preparing"}'
```

---

## Crear producto con opciones (ejemplo admin)

```bash
curl -X POST http://localhost:3000/api/v1/admin/products \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Pizza Pepperoni",
    "description": "Masa madre, pepperoni, mozzarella.",
    "price": 180,
    "option_groups": [
      {
        "name": "Tamano",
        "type": "single",
        "required": true,
        "min_select": 1,
        "max_select": 1,
        "options": [
          { "name": "Personal", "price_delta": 0 },
          { "name": "Mediana",  "price_delta": 60 },
          { "name": "Familiar", "price_delta": 120 }
        ]
      },
      {
        "name": "Extras",
        "type": "multi",
        "max_select": 4,
        "options": [
          { "name": "Queso extra", "price_delta": 25 },
          { "name": "Champinones", "price_delta": 20 }
        ]
      }
    ]
  }'
```

---

## Multi-tenancy: como funciona

1. **URL publica:** `/api/v1/t/:tenantSlug/...` -> el middleware `resolveTenantBySlug` busca el tenant por slug y deja `req.tenantId` listo.
2. **Admin:** el JWT incluye `tenant_id`. El middleware `requireAuth` lo lee y deja `req.tenantId`.
3. **Toda query SQL** usa `WHERE tenant_id = $1`. Los servicios reciben `tenantId` como primer parametro - es la convencion del proyecto.
4. Los `FOREIGN KEY ... ON DELETE CASCADE` en `tenants` permiten borrar un tenant entero limpiamente.

> Para una capa extra de aislamiento se puede activar **Postgres RLS** (Row Level Security) por `tenant_id` configurando una variable de sesion (`SET app.tenant_id = ...`) al adquirir el client del pool. La forma actual ya es segura siempre que ningun servicio omita el filtro - el codigo lo aplica de forma consistente.

---

## Anadir un nuevo tenant (sin script CLI todavia)

Hasta que se agregue un endpoint de superadmin, se puede insertar manualmente:

```sql
INSERT INTO tenants (slug, name, whatsapp_number) VALUES ('mi-tienda', 'Mi Tienda', '521...');
INSERT INTO users (tenant_id, email, password_hash, role)
  SELECT id, 'admin@mi-tienda.test',
         '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', -- "admin123"
         'admin'
    FROM tenants WHERE slug = 'mi-tienda';
```

---

## Push al repo

```bash
git init
git add .
git commit -m "feat: initial backend scaffold"
git branch -M main
git remote add origin https://github.com/lonzofrancisco/PedidosRapidos.git
git push -u origin main
```
