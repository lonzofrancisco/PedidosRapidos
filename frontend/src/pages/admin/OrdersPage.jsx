import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { ordersApi } from '../../api/orders.js';
import { formatMoney, formatDate } from '../../utils/format.js';
import { useOrderAlerts } from '../../hooks/useOrderAlerts.js';

const POLL_MS = 12_000;
const NEW_HIGHLIGHT_MS = 25_000;

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

// Parpadeo del titulo de la pestaña cuando entran pedidos y la pestaña no esta
// enfocada. Guarda el titulo original para restaurarlo al volver.
let savedTitle = null;
function flashTitle(n) {
  if (typeof document === 'undefined' || document.hasFocus()) return;
  if (savedTitle === null) savedTitle = document.title;
  document.title = `(${n}) pedido${n > 1 ? 's' : ''} nuevo${n > 1 ? 's' : ''}`;
}
function restoreTitle() {
  if (savedTitle !== null) { document.title = savedTitle; savedTitle = null; }
}

export default function OrdersPage() {
  const { token } = useAuth();
  const alerts = useOrderAlerts();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [newIds, setNewIds] = useState(() => new Set());

  // Refs para que el polling (setInterval) lea siempre el valor actual sin
  // tener que recrearse en cada cambio.
  const seenIdsRef = useRef(null);  // null = todavia no hay baseline
  const statusRef = useRef(status);
  statusRef.current = status;
  const notifyRef = useRef(alerts.notify);
  notifyRef.current = alerts.notify;

  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const data = await ordersApi.listAdmin(token, {
        status: statusRef.current || undefined,
        limit: 100,
      });
      const incoming = data.orders;
      const seen = seenIdsRef.current;
      // Solo alertamos en refrescos de fondo y cuando ya hay baseline (nunca en
      // el primer load ni al cambiar de filtro, que cambian la lista entera).
      if (background && seen) {
        const fresh = incoming.filter((o) => !seen.has(o.id));
        if (fresh.length > 0) {
          notifyRef.current(fresh);            // sonido + notificacion (si estan activas)
          flashTitle(fresh.length);            // titulo de la pestaña
          setNewIds((prev) => new Set([...prev, ...fresh.map((o) => o.id)]));
        }
      }
      seenIdsRef.current = new Set(incoming.map((o) => o.id));
      setOrders(incoming);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!background) setLoading(false);
    }
  }, [token]);

  // Carga inicial + al cambiar el filtro: reseteamos el baseline para no marcar
  // como "nuevos" pedidos que solo aparecen porque cambio el filtro.
  useEffect(() => {
    seenIdsRef.current = null;
    setNewIds(new Set());
    load({ background: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Polling de fondo (no muestra spinner ni pisa el filtro).
  useEffect(() => {
    const id = setInterval(() => load({ background: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // El resaltado "nuevo" se apaga solo despues de un rato sin pedidos nuevos.
  useEffect(() => {
    if (newIds.size === 0) return undefined;
    const t = setTimeout(() => setNewIds(new Set()), NEW_HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [newIds]);

  // Al volver a la pestaña: restaurar titulo y limpiar el resaltado.
  useEffect(() => {
    const onFocus = () => { restoreTitle(); setNewIds(new Set()); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const notifBlocked = alerts.enabled && alerts.permission === 'denied';

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Pedidos</h1>
          <p className="text-sm text-slate-600">
            {loading
              ? 'Actualizando...'
              : lastUpdated
                ? `Se actualiza solo cada ${POLL_MS / 1000}s · ultima ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Lista de pedidos recibidos.'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className={alerts.enabled ? 'btn-primary' : 'btn-secondary'}
            onClick={alerts.toggle}
            title={alerts.enabled
              ? 'Alertas activas: suena y notifica al entrar un pedido. Click para apagar.'
              : 'Activar sonido + notificacion al entrar un pedido nuevo'}
          >
            {alerts.enabled ? '🔔 Alertas activas' : '🔕 Activar alertas'}
          </button>
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => load({ background: false })}>Actualizar</button>
        </div>
      </div>

      {notifBlocked && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Las notificaciones del navegador estan bloqueadas para este sitio: el sonido suena igual, pero para
          ver los avisos visuales habilitalas desde el candado de la barra de direcciones.
        </p>
      )}

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
            {loading && orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>
            )}
            {!loading && orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No hay pedidos.</td></tr>
            )}
            {orders.map((o) => {
              const isNew = newIds.has(o.id);
              return (
                <tr key={o.id} className={`transition-colors ${isNew ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">
                    <Link to={`/admin/orders/${o.id}`} className="text-brand-600 hover:underline">
                      #{o.short_code}
                    </Link>
                    {isNew && <span className="badge bg-emerald-100 text-emerald-800 ml-2">nuevo</span>}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
