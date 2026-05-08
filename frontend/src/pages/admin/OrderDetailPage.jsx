import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ordersApi } from '../../api/orders.js';
import { formatMoney, formatDate } from '../../utils/format.js';

const NEXT_STATUS = {
  pending:   ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready:     ['delivered'],
  delivered: [],
  cancelled: [],
};

const STATUS_BADGE = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready:     'bg-emerald-100 text-emerald-800',
  delivered: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setOrder(await ordersApi.getAdmin(token, orderId));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId]);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const updated = await ordersApi.setStatus(token, orderId, status);
      setOrder(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!order) return <p className="text-slate-500">Cargando...</p>;

  const next = NEXT_STATUS[order.status] ?? [];

  return (
    <section className="space-y-4">
      <Link to="/admin/orders" className="text-sm text-slate-600 hover:text-slate-900">&larr; Pedidos</Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase">Pedido</p>
            <h1 className="text-2xl font-bold">#{order.short_code}</h1>
            <p className="text-xs text-slate-500 mt-1">{formatDate(order.created_at)}</p>
          </div>
          <span className={`badge ${STATUS_BADGE[order.status]}`}>{order.status}</span>
        </div>

        {next.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {next.map(s => (
              <button
                key={s}
                disabled={busy}
                onClick={() => setStatus(s)}
                className={s === 'cancelled' ? 'btn-danger' : 'btn-primary'}
              >
                Cambiar a "{s}"
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5 grid sm:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold text-sm mb-2">Cliente</h2>
          <div className="text-sm space-y-0.5">
            <p>{order.customer_name}</p>
            <p>{order.customer_phone}</p>
            {order.customer_address && <p>{order.customer_address}</p>}
            {order.notes && <p className="italic text-slate-500">{order.notes}</p>}
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-sm mb-2">Total</h2>
          <p className="text-2xl font-bold">{formatMoney(order.total, order.currency)}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-sm mb-3">Items</h2>
        <ul className="divide-y divide-slate-100">
          {order.items?.map(item => (
            <li key={item.id} className="py-3 flex justify-between gap-3">
              <div>
                <p className="font-medium">{item.quantity}x {item.product_name}</p>
                {item.options?.map((o, i) => (
                  <p key={i} className="text-xs text-slate-500">
                    - {o.group_name}: {(o.quantity ?? 1) > 1 ? `${o.quantity}x ` : ''}{o.option_name}
                  </p>
                ))}
                {item.notes && <p className="text-xs italic text-slate-500">{item.notes}</p>}
              </div>
              <span className="text-sm">{formatMoney(item.subtotal, order.currency)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
