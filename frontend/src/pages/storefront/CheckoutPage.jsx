import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../../hooks/useCart.js';
import { ordersApi } from '../../api/orders.js';
import { productsApi } from '../../api/products.js';
import { formatMoney } from '../../utils/format.js';
import { isPhone } from '../../utils/validate.js';
import { isOpenNow } from '../../utils/store.js';

export default function CheckoutPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const cart = useCart(slug);

  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  useEffect(() => {
    const load = () => {
      productsApi.listPublic(slug)
        .then(data => setTenant(data.tenant))
        .catch(() => {}); // silently fail, will show error on submit
    };
    load();
    setLoadingTenant(false);

    // Recargar datos del tenant cada 10 segundos para capturar cambios
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [slug]);

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="mb-4 text-slate-600 dark:text-slate-300">Tu carrito esta vacio.</p>
        <Link to={`/t/${slug}`} className="btn-primary">Volver al menu</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validar estado de tienda
    if (tenant && !isOpenNow(tenant)) {
      setError('Esta tienda está cerrada.');
      return;
    }

    // Validar mínimo de compra
    const shippingCost = Number(tenant?.shipping_cost ?? 0);
    const totalWithShipping = cart.total + shippingCost;
    if (tenant?.min_order_amount && totalWithShipping < tenant.min_order_amount) {
      setError(`El pedido debe ser de al menos ${formatMoney(tenant.min_order_amount, tenant.currency)}`);
      return;
    }

    if (!isPhone(form.phone)) {
      setError('Ingresá un telefono valido (con codigo de pais). Ej: 5491112345678');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        customer: {
          name: form.name,
          phone: form.phone,
          address: form.address || undefined,
          notes: form.notes || undefined,
        },
        items: cart.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          // Forma rica con cantidad por opcion (para grupos tipo quantity).
          selections: (i.options ?? []).map(o => ({
            option_id: o.option_id,
            quantity: o.quantity ?? 1,
          })),
          notes: i.notes,
        })),
      };
      const result = await ordersApi.create(slug, payload);

      // Limpiar carrito ANTES de navegar para evitar race conditions
      const cartKey = `pedidos:cart:${slug}`;
      localStorage.removeItem(cartKey);
      localStorage.removeItem(`${cartKey}:temp`);
      cart.clear();

      // Navegar a página de éxito
      navigate(`/t/${slug}/orders/${result.order.id}`, {
        state: { whatsappUrl: result.whatsappUrl, justCreated: true },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <header className="bg-white border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link to={`/t/${slug}`} className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">&larr; Volver al menu</Link>
          <h1 className="text-xl font-bold mt-1">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h2 className="font-semibold">Tus datos</h2>

          <div>
            <label className="label">Nombre *</label>
            <input className="input" required value={form.name}
                   onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Telefono * (incluye codigo de pais)</label>
            <input className="input" required value={form.phone}
                   onChange={(e) => setForm({ ...form, phone: e.target.value })}
                   placeholder="5215598765432" />
          </div>
          <div>
            <label className="label">Direccion</label>
            <input className="input" value={form.address}
                   onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={3} value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
            {error || ' '}
          </p>

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
            {submitting ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </form>

        <aside className="card p-5 h-fit space-y-3">
          <h2 className="font-semibold mb-3">Resumen</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {cart.items.map(i => (
              <li key={i.uid} className="py-2 flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{i.quantity}x {i.product_name}</p>
                  {i.options?.map((o, idx) => (
                    <p key={idx} className="text-xs text-slate-500 dark:text-slate-400">
                      - {(o.quantity ?? 1) > 1 ? `${o.quantity}x ` : ''}{o.option_name}
                    </p>
                  ))}
                </div>
                <span>{formatMoney(i.unit_price * i.quantity, tenant?.currency)}</span>
              </li>
            ))}
          </ul>

          {tenant && Number(tenant.shipping_cost ?? 0) > 0 && (
            <div className="text-sm flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">Envío</span>
              <span>{formatMoney(tenant.shipping_cost, tenant.currency)}</span>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 flex justify-between font-bold dark:border-slate-700">
            <span>Total</span>
            <span>{formatMoney(cart.total + (tenant ? Number(tenant.shipping_cost ?? 0) : 0), tenant?.currency)}</span>
          </div>

          {!loadingTenant && tenant && !isOpenNow(tenant) && (
            <p className="text-xs text-red-700 bg-red-50 rounded px-3 py-2 dark:text-red-200 dark:bg-red-900/30">
              Esta tienda está cerrada.
            </p>
          )}

          {!loadingTenant && tenant?.min_order_amount && cart.total + Number(tenant.shipping_cost ?? 0) < tenant.min_order_amount && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 dark:text-amber-200 dark:bg-amber-900/30">
              Falta {formatMoney(tenant.min_order_amount - (cart.total + Number(tenant.shipping_cost ?? 0)), tenant.currency)} para alcanzar el mínimo de compra.
            </p>
          )}
        </aside>
      </main>
    </div>
  );
}
