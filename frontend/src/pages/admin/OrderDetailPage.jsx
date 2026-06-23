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

const STATUS_LABELS = {
  pending:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmado',  className: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'En cocina',   className: 'bg-purple-100 text-purple-800' },
  ready:     { label: 'Listo',       className: 'bg-emerald-100 text-emerald-800' },
  delivered: { label: 'Entregado',   className: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelado',   className: 'bg-red-100 text-red-800' },
};

/**
 * Detalle de pedido compartido por la tienda y el comprador.
 *
 * - Si hay sesion admin y el pedido es de esa tienda -> lectura admin +
 *   acciones de gestion (cambiar estado). `canManage = true`.
 * - Si no (comprador sin login, o admin de otra tienda) -> lectura publica
 *   por id (magic link) en modo solo lectura. `canManage = false`.
 */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      if (token) {
        try {
          const o = await ordersApi.getAdmin(token, orderId);
          setOrder(o);
          setCanManage(true);
          return;
        } catch {
          // El pedido no es de su tienda (o token vencido): cae a vista publica.
        }
      }
      const o = await ordersApi.getById(orderId);
      setOrder(o);
      setCanManage(false);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orderId, token]);

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

  if (error) return <Center>{error}</Center>;
  if (!order) return <Center>Cargando...</Center>;

  const next = canManage ? (NEXT_STATUS[order.status] ?? []) : [];
  const statusMeta = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {canManage ? (
          <Link to="/admin/orders" className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">&larr; Pedidos</Link>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Seguimiento de tu pedido</p>
        )}

        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase dark:text-slate-400">Pedido</p>
              <h1 className="text-2xl font-bold">#{order.short_code}</h1>
              <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">{formatDate(order.created_at)}</p>
            </div>
            <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
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
                  Cambiar a "{STATUS_LABELS[s]?.label ?? s}"
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
              {order.notes && <p className="italic text-slate-500 dark:text-slate-400">{order.notes}</p>}
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-sm mb-2">Total</h2>
            <p className="text-2xl font-bold">{formatMoney(order.total, order.currency)}</p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-3">Items</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {order.items?.map(item => (
              <li key={item.id} className="py-3 flex justify-between gap-3">
                <div>
                  <p className="font-medium">{item.quantity}x {item.product_name}</p>
                  {item.options?.map((o, i) => (
                    <p key={i} className="text-xs text-slate-500 dark:text-slate-400">
                      - {o.group_name}: {(o.quantity ?? 1) > 1 ? `${o.quantity}x ` : ''}{o.option_name}
                    </p>
                  ))}
                  {item.notes && <p className="text-xs italic text-slate-500 dark:text-slate-400">{item.notes}</p>}
                </div>
                <span className="text-sm">{formatMoney(item.subtotal, order.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-900">
      <p className="text-slate-600 dark:text-slate-300">{children}</p>
    </div>
  );
}
