import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ordersApi } from '../../api/orders.js';
import { formatMoney, formatDate } from '../../utils/format.js';

const STATUS_LABELS = {
  pending:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmado',  className: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'En cocina',   className: 'bg-purple-100 text-purple-800' },
  ready:     { label: 'Listo',       className: 'bg-emerald-100 text-emerald-800' },
  delivered: { label: 'Entregado',   className: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelado',   className: 'bg-red-100 text-red-800' },
};

export default function OrderSuccessPage() {
  const { slug, orderId } = useParams();
  const location = useLocation();
  const initialWhatsapp = location.state?.whatsappUrl ?? null;
  const justCreated = location.state?.justCreated ?? false;

  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    ordersApi.getPublic(slug, orderId).then(setOrder).catch((e) => setError(e.message));
  }, [slug, orderId]);

  if (error) return <Center>{error}</Center>;
  if (!order) return <Center>Cargando...</Center>;

  const statusMeta = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-xl mx-auto card p-6">
        {justCreated && (
          <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <p className="font-semibold text-emerald-800">Pedido recibido!</p>
            <p className="text-sm text-emerald-700 mt-1">
              Avisale a la tienda enviando el resumen por WhatsApp.
            </p>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase">Pedido</p>
            <h1 className="text-2xl font-bold">#{order.short_code}</h1>
            <p className="text-xs text-slate-500 mt-1">{formatDate(order.created_at)}</p>
          </div>
          <span className={`badge ${statusMeta.className}`}>{statusMeta.label}</span>
        </div>

        {initialWhatsapp && (
          <a
            href={initialWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full mb-5"
          >
            Enviar por WhatsApp
          </a>
        )}

        <div className="space-y-4">
          <section>
            <h2 className="font-semibold text-sm mb-2">Cliente</h2>
            <div className="text-sm text-slate-700 space-y-0.5">
              <p>{order.customer_name}</p>
              <p>{order.customer_phone}</p>
              {order.customer_address && <p>{order.customer_address}</p>}
              {order.notes && <p className="italic text-slate-500">{order.notes}</p>}
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-sm mb-2">Items</h2>
            <ul className="divide-y divide-slate-100">
              {order.items?.map(item => (
                <li key={item.id} className="py-2 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.quantity}x {item.product_name}</p>
                    {item.options?.map((o, i) => (
                      <p key={i} className="text-xs text-slate-500">- {o.group_name}: {o.option_name}</p>
                    ))}
                    {item.notes && <p className="text-xs italic text-slate-500">{item.notes}</p>}
                  </div>
                  <span>{formatMoney(item.subtotal, order.currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-between font-bold border-t border-slate-200 pt-3">
            <span>Total</span>
            <span>{formatMoney(order.total, order.currency)}</span>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link to={`/t/${slug}`} className="text-sm text-brand-600 hover:underline">
            Volver al menu
          </Link>
        </div>
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
