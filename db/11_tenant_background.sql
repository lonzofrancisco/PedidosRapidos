-- =====================================================================
-- Migracion: tenants.background_url (imagen de fondo del storefront)
-- =====================================================================
-- TEXT nullable. Se muestra difuminada detras del catalogo para que las
-- cards de productos resalten. Opcional. Acepta path relativo "/uploads/..."
-- (lo que devuelve el upload local) o una URL absoluta.
-- Idempotente: se puede correr sobre una DB existente sin romper nada.
-- =====================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS background_url TEXT;
