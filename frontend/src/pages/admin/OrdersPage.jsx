import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ordersApi } from '../../api/orders.js';
import { formatMoney, formatDate } from '../../utils/format.js';

const STATUSES = [
  { value: '',          label: 'Todos' },
  { value: 'pending',   label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'preparing', label: 'En cocina' },
  { value: 'ready',     label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const STATUS_BADGE = {
  pending:   'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready:     'bg-emerald-100 text-emerald-800',
  delivered: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await ordersApi.listAdmin(token, { status: status || undefined, limit: 100 });
      setOrders(data.orders);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [status]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Pedidos</h1>
          <p className="text-sm text-slate-600">Lista de pedidos recibidos.</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn-secondary" onClick={refresh}>Actualizar</button>
        </div>
      </div>

      <p className={`text-sm text-red-600 mb-3 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
        {error || ' '}
      </p>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Codigo</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2">Recibido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No hay pedidos.</td></tr>
            )}
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono">
                  <Link to={`/admin/orders/${o.id}`} className="text-brand-600 hover:underline">
                    #{o.short_code}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{o.customer_name}</p>
                  <p className="text-xs text-slate-500">{o.customer_phone}</p>
                </td>
                <td className="px-4 py-3">{formatMoney(o.total, o.currency)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_BADGE[o.status] ?? 'bg-slate-100'}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
