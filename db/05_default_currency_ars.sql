-- =====================================================================
-- Migracion: moneda por defecto -> ARS (pesos argentinos)
-- =====================================================================
-- Los archivos de docker-entrypoint-initdb.d solo corren la primera vez
-- que se crea el volumen de Postgres. Para aplicar este cambio en una
-- BD ya existente, ejecutar este SQL desde Adminer (http://localhost:8081)
-- o psql.
--
-- Cambios:
--  1) Default de tenants.currency  : MXN -> ARS
--  2) Default de orders.currency   : MXN -> ARS
--  3) Tenants ya creados con 'MXN' -> 'ARS' (asume despliegue donde solo
--     habia data demo; revisar antes de correr en prod con tenants reales).
-- =====================================================================

ALTER TABLE tenants ALTER COLUMN currency SET DEFAULT 'ARS';
ALTER TABLE orders  ALTER COLUMN currency SET DEFAULT 'ARS';

UPDATE tenants SET currency = 'ARS' WHERE currency = 'MXN';
UPDATE orders  SET currency = 'ARS' WHERE currency = 'MXN';
