import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../../hooks/useCart.js';
import { ordersApi } from '../../api/orders.js';
import { formatMoney } from '../../utils/format.js';

export default function CheckoutPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const cart = useCart(slug);

  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="mb-4 text-slate-600">Tu carrito esta vacio.</p>
        <Link to={`/t/${slug}`} className="btn-primary">Volver al menu</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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
      cart.clear();
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
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link to={`/t/${slug}`} className="text-sm text-slate-600 hover:text-slate-900">&larr; Volver al menu</Link>
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

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
            {submitting ? 'Enviando...' : 'Confirmar pedido'}
          </button>
        </form>

        <aside className="card p-5 h-fit">
          <h2 className="font-semibold mb-3">Resumen</h2>
          <ul className="divide-y divide-slate-100">
            {cart.items.map(i => (
              <li key={i.uid} className="py-2 flex justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{i.quantity}x {i.product_name}</p>
                  {i.options?.map((o, idx) => (
                    <p key={idx} className="text-xs text-slate-500">
                      - {(o.quantity ?? 1) > 1 ? `${o.quantity}x ` : ''}{o.option_name}
                    </p>
                  ))}
                </div>
                <span>{formatMoney(i.unit_price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span>{formatMoney(cart.total)}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
