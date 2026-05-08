import { useCallback, useEffect, useState } from 'react';

/**
 * Carrito persistido en localStorage, scopeado por slug de tenant.
 *
 * Cada item:
 *   { uid, product_id, product_name, unit_price, quantity, option_ids[], options[], notes }
 *
 *   - uid identifica visualmente la linea (mismo producto puede aparecer
 *     varias veces con distintas opciones).
 */
export function useCart(slug) {
  const storageKey = `pedidos:cart:${slug}`;
  const [items, setItems] = useState(() => readCart(storageKey));

  useEffect(() => { setItems(readCart(storageKey)); }, [storageKey]);

  useEffect(() => {
    if (items.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const addItem = useCallback((item) => {
    setItems(prev => [...prev, { ...item, uid: crypto.randomUUID() }]);
  }, []);

  const setQuantity = useCallback((uid, quantity) => {
    setItems(prev => prev
      .map(i => i.uid === uid ? { ...i, quantity } : i)
      .filter(i => i.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((uid) => {
    setItems(prev => prev.filter(i => i.uid !== uid));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return { items, addItem, setQuantity, removeItem, clear, total, count };
}

function readCart(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
