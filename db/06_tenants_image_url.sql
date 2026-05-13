-- =====================================================================
-- Migracion: tenants.image_url (logo/foto de la tienda)
-- =====================================================================
-- TEXT nullable. Se espera una URL publica HTTPS. No es obligatorio.
-- Ejemplo:
--   UPDATE tenants SET image_url = 'https://cdn.miapp.com/burger-demo.png'
--    WHERE slug = 'burger-demo';
-- =====================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS image_url TEXT;
