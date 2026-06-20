import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { reportsApi } from '../../api/reports.js';
import { formatMoney } from '../../utils/format.js';

const RANGES = [
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
];

const STATUS_LABELS = {
  pending:   'Pendientes',
  confirmed: 'Confirmados',
  preparing: 'En cocina',
  ready:     'Listos',
  delivered: 'Entregados',
  cancelled: 'Cancelados',
};

export default function ReportsPage() {
  const { token } = useAuth();
  const [range, setRange] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reportsApi.summary(token, range)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((err) => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token, range]);

  const cur = data?.currency ?? 'ARS';
  const maxDayRevenue = data && data.byDay.length ? Math.max(...data.byDay.map((d) => d.revenue)) : 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Reportes</h1>
          <p className="text-sm text-slate-600">
            Ventas de los últimos {RANGES.find((r) => r.value === range)?.label}. No incluye pedidos cancelados.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={r.value === range ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>{error || ' '}</p>

      {loading && !data && <p className="text-slate-500">Cargando...</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Kpi label="Facturación" value={formatMoney(data.totals.revenue, cur)} />
            <Kpi label="Pedidos" value={data.totals.orders} />
            <Kpi label="Ticket promedio" value={formatMoney(data.totals.avgTicket, cur)} />
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-sm mb-3">Ventas por día</h2>
            {data.byDay.length === 0 ? (
              <p className="text-sm text-slate-500">Sin ventas en el período.</p>
            ) : (
              <div className="space-y-1">
                {data.byDay.map((d) => (
                  <div key={d.day} className="flex items-center gap-2 text-xs">
                    <span className="w-12 shrink-0 text-slate-500">{d.day.slice(5)}</span>
                    <div className="flex-1 bg-slate-100 rounded h-5 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded"
                        style={{ width: `${maxDayRevenue ? Math.max(3, (d.revenue / maxDayRevenue) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right">{formatMoney(d.revenue, cur)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card p-5">
              <h2 className="font-semibold text-sm mb-3">Productos más vendidos</h2>
              {data.topProducts.length === 0 ? (
                <p className="text-sm text-slate-500">Sin datos.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.topProducts.map((p, i) => (
                    <li key={i} className="py-2 flex justify-between gap-2">
                      <span className="font-medium">{p.qty}x {p.product_name}</span>
                      <span className="text-slate-500">{formatMoney(p.revenue, cur)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-semibold text-sm mb-3">Pedidos por estado</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {data.byStatus.map((s) => (
                  <li key={s.status} className="py-2 flex justify-between">
                    <span>{STATUS_LABELS[s.status] ?? s.status}</span>
                    <span className="text-slate-500">{s.orders}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
