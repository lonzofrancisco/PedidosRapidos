import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  superadminApi, getSuperSession, setSuperSession, setAdminSession,
} from '../../api/superadmin.js';

const PLAN_LABEL = { trial: 'Prueba', active: 'Activo', expired: 'Vencido' };
const PLAN_CLASS = {
  trial:   'bg-amber-100 text-amber-800',
  active:  'bg-emerald-100 text-emerald-800',
  expired: 'bg-red-100 text-red-700',
};

const ACTION_LABEL = {
  create_tenant:  'Creo tienda',
  delete_tenant:  'Elimino tienda',
  extend:         'Extendio plan',
  set_active:     'Cambio estado',
  reset_password: 'Reset contrasena',
  update_plan:    'Edito plan',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : '—');

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</p>
    </div>
  );
}

function PlanBadge({ tenant }) {
  const status = tenant.plan?.status ?? tenant.plan_status;
  return (
    <span className={`badge ${PLAN_CLASS[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {PLAN_LABEL[status] ?? status}
    </span>
  );
}

// Aviso copiable con una contrasena temporal (al crear o resetear).
function CredentialNotice({ notice, onClose }) {
  const copy = () => { navigator.clipboard?.writeText(notice.password).catch(() => {}); };
  return (
    <div className="card p-4 border border-emerald-200 bg-emerald-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-emerald-900">{notice.title}</p>
          <p className="text-sm text-emerald-800 mt-1">
            Acceso: <strong>{notice.email}</strong>
          </p>
          <p className="text-sm text-emerald-800">
            Contrasena temporal: <code className="bg-white px-2 py-0.5 rounded border border-emerald-200">{notice.password}</code>
          </p>
          <p className="text-xs text-emerald-700 mt-1">Guardala ahora: no se vuelve a mostrar.</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button className="btn-secondary text-xs px-2 py-1" onClick={copy}>Copiar</button>
          <button className="text-xs text-emerald-700 hover:underline" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function CreateTenantModal({ token, onClose, onCreated }) {
  const [form, setForm] = useState({
    tenant_name: '', slug: '', whatsapp_number: '', admin_email: '', admin_password: '', trial_days: 15,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        tenant_name: form.tenant_name.trim(),
        slug: form.slug.trim().toLowerCase(),
        whatsapp_number: form.whatsapp_number.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        trial_days: Number(form.trial_days) || 0,
      };
      if (form.admin_password.trim()) payload.admin_password = form.admin_password.trim();
      const res = await superadminApi.createTenant(token, payload);
      onCreated({ ...res, adminEmail: payload.admin_email });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onMouseDown={onClose}>
      <form
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto"
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Nueva tienda</h2>
        <div>
          <label className="label">Nombre de la tienda</label>
          <input className="input" required value={form.tenant_name} onChange={set('tenant_name')} placeholder="Burger Joe" />
        </div>
        <div>
          <label className="label">Slug</label>
          <input className="input" required value={form.slug} onChange={set('slug')} placeholder="burger-joe" />
        </div>
        <div>
          <label className="label">WhatsApp (con codigo de pais, sin '+')</label>
          <input className="input" required value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="5491112345678" />
        </div>
        <div>
          <label className="label">Email del admin</label>
          <input className="input" type="email" required value={form.admin_email} onChange={set('admin_email')} placeholder="duenio@tienda.com" />
        </div>
        <div>
          <label className="label">Contrasena (opcional)</label>
          <input className="input" type="text" value={form.admin_password} onChange={set('admin_password')} placeholder="Vacio = se genera una temporal" />
        </div>
        <div>
          <label className="label">Dias de prueba</label>
          <input className="input" type="number" min={0} max={3650} value={form.trial_days} onChange={set('trial_days')} />
        </div>

        <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
          {error || ' '}
        </p>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary disabled:opacity-50" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear tienda'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const session = getSuperSession();
  const token = session?.token ?? null;

  const [data, setData] = useState({ tenants: [], stats: null });
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState(null);

  const logout = useCallback(() => {
    setSuperSession(null);
    navigate('/superAdmin/login', { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superadminApi.listTenants(token);
      setData(res);
    } catch (err) {
      if (err.status === 401 || err.status === 403) return logout();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await superadminApi.listAudit(token, 50);
      setAudit(res.entries ?? []);
    } catch { /* el audit es secundario, no rompe la vista */ }
  }, [token]);

  useEffect(() => {
    if (!token) { navigate('/superAdmin/login', { replace: true }); return; }
    load();
    loadAudit();
  }, [token, load, loadAudit, navigate]);

  const runAction = async (id, fn) => {
    setBusyId(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
      await loadAudit();
    } catch (err) {
      if (err.status === 401 || err.status === 403) return logout();
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const onExtend = (t, days) => runAction(t.id, () => superadminApi.extend(token, t.id, days));

  const onExtendCustom = (t) => {
    const raw = window.prompt(`Extender "${t.name}" cuantos dias?`, '30');
    if (raw == null) return;
    const days = parseInt(raw, 10);
    if (!Number.isInteger(days) || days <= 0) { setError('Cantidad de dias invalida'); return; }
    onExtend(t, days);
  };

  const onToggleActive = (t) => {
    const action = t.active ? 'dar de baja' : 'reactivar';
    if (!window.confirm(`Seguro que queres ${action} "${t.name}"?`)) return;
    runAction(t.id, () => superadminApi.setActive(token, t.id, !t.active));
  };

  const onReset = (t) => {
    if (!window.confirm(`Resetear la contrasena del admin de "${t.name}"? Se genera una nueva.`)) return;
    runAction(t.id, async () => {
      const res = await superadminApi.resetPassword(token, t.id, undefined);
      setNotice({ title: `Nueva contrasena para ${t.name}`, email: res.email, password: res.password });
    });
  };

  const onDelete = (t) => {
    const typed = window.prompt(
      `BORRA "${t.name}" y TODOS sus pedidos y productos. No se puede deshacer.\n\nEscribi el slug "${t.slug}" para confirmar:`
    );
    if (typed == null) return;
    if (typed.trim() !== t.slug) { setError('El slug no coincide. No se elimino nada.'); return; }
    runAction(t.id, () => superadminApi.deleteTenant(token, t.id));
  };

  // Genera el acceso de admin del tenant (impersonate) y abre la ruta indicada
  // del panel en una pestana nueva. Se reusa para "Entrar" y "Configuracion".
  const openAdminAt = (t, path) => runAction(t.id, async () => {
    const result = await superadminApi.impersonate(token, t.id);
    setAdminSession({ token: result.token, user: result.user });
    window.open(path, '_blank', 'noopener');
  });

  const onCreated = ({ tenant, tempPassword, adminEmail }) => {
    setShowCreate(false);
    if (tempPassword) {
      setNotice({ title: `Tienda "${tenant.name}" creada`, email: adminEmail, password: tempPassword });
    }
    load();
    loadAudit();
  };

  const s = data.stats;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data.tenants;
    return data.tenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
    );
  }, [data.tenants, query]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold">Panel del sistema</h1>
            <p className="text-xs text-slate-400">{session?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-3 py-1.5">
              + Nueva tienda
            </button>
            <button onClick={logout} className="text-sm text-slate-300 hover:text-white">
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {s && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Clientes" value={s.total} />
            <StatCard label="Activos" value={s.active} accent="text-emerald-600" />
            <StatCard label="En prueba" value={s.trial} accent="text-amber-600" />
            <StatCard label="Vencidos" value={s.expired} accent="text-red-600" />
            <StatCard label="De baja" value={s.suspended} accent="text-slate-500" />
          </div>
        )}

        {notice && <CredentialNotice notice={notice} onClose={() => setNotice(null)} />}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Tiendas</h2>
          <div className="flex items-center gap-2">
            <input
              className="input text-sm py-1.5 w-56"
              placeholder="Buscar por nombre o slug"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={() => { load(); loadAudit(); }} className="btn-secondary text-sm" disabled={loading}>
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
          {error || ' '}
        </p>

        {loading && data.tenants.length === 0 ? (
          <p className="text-slate-500">Cargando clientes...</p>
        ) : data.tenants.length === 0 ? (
          <p className="text-slate-500">Todavia no hay tiendas registradas.</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500">Ninguna tienda coincide con "{query}".</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tienda</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Vence</th>
                  <th className="px-4 py-3 text-center">Prod.</th>
                  <th className="px-4 py-3 text-center">Pedidos</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const busy = busyId === t.id;
                  const expiresAt = t.plan?.expiresAt ?? t.paid_until ?? t.trial_ends_at;
                  return (
                    <tr key={t.id} className={!t.active ? 'bg-slate-50/60 opacity-70' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-slate-500">/{t.slug}</div>
                        {!t.active && <span className="badge bg-slate-200 text-slate-600 mt-1">De baja</span>}
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge tenant={t} />
                        {t.plan?.daysLeft != null && t.plan.isActive && (
                          <div className="text-xs text-slate-500 mt-1">{t.plan.daysLeft} dias</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(expiresAt)}</td>
                      <td className="px-4 py-3 text-center">{t.products_count}</td>
                      <td className="px-4 py-3 text-center">{t.orders_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button className="btn-secondary text-xs px-2 py-1 disabled:opacity-40"
                                  disabled={busy} onClick={() => onExtend(t, 30)}>+30d</button>
                          <button className="btn-secondary text-xs px-2 py-1 disabled:opacity-40"
                                  disabled={busy} onClick={() => onExtendCustom(t)}>+dias</button>
                          <button className="btn-secondary text-xs px-2 py-1 disabled:opacity-40"
                                  disabled={busy} onClick={() => openAdminAt(t, '/admin')}>Entrar</button>
                          <a className="btn-secondary text-xs px-2 py-1" href={`/t/${t.slug}`}
                             target="_blank" rel="noreferrer">Ver</a>
                          <button className="btn-secondary text-xs px-2 py-1 disabled:opacity-40"
                                  disabled={busy} onClick={() => openAdminAt(t, '/admin/settings')}>Configuracion</button>
                          <button className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                  disabled={busy} onClick={() => onReset(t)}>Reset pass</button>
                          <button
                            className={`text-xs px-2 py-1 rounded-md border disabled:opacity-40 ${
                              t.active
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                            disabled={busy}
                            onClick={() => onToggleActive(t)}
                          >
                            {t.active ? 'Dar de baja' : 'Reactivar'}
                          </button>
                          <button className="text-xs px-2 py-1 rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40"
                                  disabled={busy} onClick={() => onDelete(t)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Actividad reciente (audit log) */}
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Actividad reciente</h2>
          {audit.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin actividad registrada.</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Cuando</th>
                    <th className="px-4 py-2">Accion</th>
                    <th className="px-4 py-2">Tienda</th>
                    <th className="px-4 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500">{fmtDateTime(a.created_at)}</td>
                      <td className="px-4 py-2">{ACTION_LABEL[a.action] ?? a.action}</td>
                      <td className="px-4 py-2">{a.tenant_slug ? `/${a.tenant_slug}` : '—'}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {a.detail ? JSON.stringify(a.detail) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {showCreate && (
        <CreateTenantModal token={token} onClose={() => setShowCreate(false)} onCreated={onCreated} />
      )}
    </div>
  );
}
