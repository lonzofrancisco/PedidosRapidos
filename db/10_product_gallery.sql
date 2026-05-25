-- =====================================================================
-- Galeria de imagenes por producto
-- =====================================================================
-- Antes products tenia una sola image_url. Agregamos image_urls (array
-- ordenado): la primera es la portada y image_url se mantiene sincronizado
-- con ella para no romper lo que ya la consume (storefront, WhatsApp).
-- Idempotente: se puede correr sobre una DB existente sin romper nada.
-- =====================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: la imagen unica actual pasa a ser la primera de la galeria.
UPDATE products
   SET image_urls = ARRAY[image_url]
 WHERE image_url IS NOT NULL
   AND image_url <> ''
   AND image_urls = '{}';
