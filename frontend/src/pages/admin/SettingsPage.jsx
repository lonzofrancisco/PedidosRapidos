import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { tenantApi } from '../../api/tenant.js';
import { billingApi } from '../../api/billing.js';

function planInfo(tenant) {
  if (!tenant) return null;
  const now = new Date();
  const trial = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const paid  = tenant.paid_until    ? new Date(tenant.paid_until)    : null;
  let status = tenant.plan_status;
  let expiresAt = null;
  if (status === 'trial')  { expiresAt = trial; if (!trial || trial <= now) status = 'expired'; }
  if (status === 'active') { expiresAt = paid;  if (!paid  || paid  <= now) status = 'expired'; }
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000)) : null;
  return { status, expiresAt, daysLeft };
}

function PlanBanner({ tenant, billing, onRenew, renewing }) {
  const info = planInfo(tenant);
  if (!info) return null;
  const fmt = (d) => d?.toLocaleDateString();
  const canPay = Boolean(billing?.enabled);
  const priceLabel = canPay ? `$${billing.price} ${billing.currency}/mes` : null;

  const RenewBtn = ({ primary, label }) => (
    canPay ? (
      <button
        type="button"
        className={`${primary ? 'btn-primary' : 'btn-secondary'} mt-3`}
        disabled={renewing}
        onClick={onRenew}
      >
        {renewing ? 'Redirigiendo a Mercado Pago...' : `${label}${priceLabel ? ` · ${priceLabel}` : ''}`}
      </button>
    ) : null
  );

  if (info.status === 'expired') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
        <p className="font-semibold text-red-800">Tu plan expiró</p>
        <p className="text-sm text-red-700 mt-1">
          Tu tienda pública está temporalmente desactivada.
          {canPay ? ' Reactivala pagando el plan mensual.' : ' Para reactivarla, contactá al soporte para abonar el plan mensual.'}
        </p>
        <RenewBtn primary label="Renovar plan ahora" />
      </div>
    );
  }
  if (info.status === 'trial') {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-4">
        <p className="font-semibold text-amber-900">
          Prueba gratis — te quedan {info.daysLeft} día{info.daysLeft === 1 ? '' : 's'}
        </p>
        <p className="text-sm text-amber-800 mt-1">
          Vence el {fmt(info.expiresAt)}. Después se activa el plan mensual.
        </p>
        <RenewBtn label="Pagar el plan ahora" />
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
      <p className="font-semibold text-emerald-900">Plan activo</p>
      <p className="text-sm text-emerald-800 mt-1">
        Próxima fecha de pago: {fmt(info.expiresAt)}.
      </p>
      <RenewBtn label="Renovar un mes más" />
    </div>
  );
}

export default function SettingsPage() {
  const { token } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState({ name: '', whatsapp_number: '', image_url: '', background_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [billing, setBilling] = useState(null);
  const [renewing, setRenewing] = useState(false);
  const [pagoMsg, setPagoMsg] = useState(null);
  const fileRef = useRef(null);
  const bgFileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await tenantApi.get(token);
      setTenant(data);
      setForm({
        name: data.name ?? '',
        whatsapp_number: data.whatsapp_number ?? '',
        image_url: data.image_url ?? '',
        background_url: data.background_url ?? '',
      });
      setBilling(await billingApi.config(token).catch(() => null));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Al volver de Mercado Pago (back_urls) mostramos el resultado del pago.
  useEffect(() => {
    const pago = new URLSearchParams(window.location.search).get('pago');
    if (!pago) return;
    if (pago === 'ok') setPagoMsg({ ok: true, text: 'Recibimos tu pago. En unos segundos tu plan queda activo (recargá si no se actualiza).' });
    else if (pago === 'pendiente') setPagoMsg({ ok: true, text: 'Tu pago quedó pendiente de acreditación.' });
    else setPagoMsg({ ok: false, text: 'No se pudo completar el pago. Probá de nuevo.' });
  }, []);

  const doRenew = async () => {
    setError(null);
    setRenewing(true);
    try {
      const { url } = await billingApi.renew(token);
      window.location.href = url; // redirige a Checkout Pro
    } catch (err) {
      setError(err.message);
      setRenewing(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const patch = {
        name: form.name,
        whatsapp_number: form.whatsapp_number,
        image_url: form.image_url || null,
        background_url: form.background_url || null,
      };
      const updated = await tenantApi.update(token, patch);
      setTenant(updated);
      setMessage('Guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = () => fileRef.current?.click();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reseleccionar el mismo archivo
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen excede 2 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const { tenant: updated } = await tenantApi.uploadImage(token, file);
      setTenant(updated);
      setForm((f) => ({ ...f, image_url: updated.image_url ?? '' }));
      setMessage('Imagen actualizada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const onRemoveImage = async () => {
    if (!confirm('Quitar la imagen de la tienda?')) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await tenantApi.update(token, { image_url: null });
      setTenant(updated);
      setForm((f) => ({ ...f, image_url: '' }));
      setMessage('Imagen eliminada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onPickBg = () => bgFileRef.current?.click();

  const onBgFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reseleccionar el mismo archivo
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen de fondo excede 5 MB.');
      return;
    }
    setUploadingBg(true);
    setError(null);
    setMessage(null);
    try {
      const { tenant: updated } = await tenantApi.uploadBackground(token, file);
      setTenant(updated);
      setForm((f) => ({ ...f, background_url: updated.background_url ?? '' }));
      setMessage('Fondo actualizado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingBg(false);
    }
  };

  const onRemoveBackground = async () => {
    if (!confirm('Quitar el fondo de la tienda?')) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await tenantApi.update(token, { background_url: null });
      setTenant(updated);
      setForm((f) => ({ ...f, background_url: '' }));
      setMessage('Fondo eliminado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-slate-500">Cargando...</p>;

  return (
    <section className="max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Tienda</h1>
        <p className="text-sm text-slate-600">
          Configura el logo y los datos publicos de tu tienda.
        </p>
      </div>

      {pagoMsg && (
        <div className={`rounded-lg p-3 mb-4 text-sm border ${pagoMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {pagoMsg.text}
        </div>
      )}

      <PlanBanner tenant={tenant} billing={billing} onRenew={doRenew} renewing={renewing} />

      <div className="card p-5 space-y-5">
        {/* Imagen */}
        <div>
          <label className="label">Imagen de la tienda</label>
          <div className="flex items-center gap-4 mt-2">
            <div className="h-20 w-20 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-xs text-slate-400">
              {form.image_url ? (
                <img
                  src={form.image_url}
                  alt="Logo"
                  className="h-full w-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span>sin imagen</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={uploading}
                onClick={onPickFile}
              >
                {uploading ? 'Subiendo...' : 'Subir imagen'}
              </button>
              {form.image_url && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline self-start"
                  onClick={onRemoveImage}
                  disabled={saving}
                >
                  Quitar imagen
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            JPG, PNG, WEBP o GIF. Maximo 2 MB.
          </p>
        </div>

        {/* Fondo de la tienda */}
        <div className="pt-2 border-t border-slate-100">
          <label className="label">Fondo de la tienda</label>
          <div className="mt-2 relative h-28 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            {form.background_url ? (
              <>
                <img
                  src={form.background_url}
                  alt="Fondo"
                  className="absolute inset-0 h-full w-full object-cover blur-sm scale-105"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-white/40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-lg bg-white shadow px-3 py-2 text-xs text-slate-600">
                    Así resaltan tus productos
                  </span>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                sin fondo
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" className="btn-secondary" disabled={uploadingBg} onClick={onPickBg}>
              {uploadingBg ? 'Subiendo...' : 'Subir fondo'}
            </button>
            {form.background_url && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={onRemoveBackground}
                disabled={saving}
              >
                Quitar fondo
              </button>
            )}
            <input
              ref={bgFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onBgFileChange}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Se muestra difuminado detrás de tus productos. JPG, PNG, WEBP o GIF. Máximo 5 MB.
          </p>
        </div>

        {/* Datos basicos */}
        <form onSubmit={onSave} className="space-y-4 pt-2 border-t border-slate-100">
          <div>
            <label className="label">Nombre de la tienda</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">WhatsApp (con codigo de pais, sin '+')</label>
            <input
              className="input"
              required
              value={form.whatsapp_number}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              placeholder="5491112345678"
            />
            <p className="text-xs text-slate-500 mt-1">
              Numero al que los clientes envian sus pedidos.
            </p>
          </div>

          <div className="text-xs text-slate-500">
            <p><strong>Slug:</strong> {tenant?.slug}</p>
            <p><strong>Moneda:</strong> {tenant?.currency}</p>
          </div>

          <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
            {error || ' '}
          </p>
          <p className={`text-sm text-emerald-700 min-h-[1.25rem] ${message ? '' : 'invisible'}`}>
            {message || ' '}
          </p>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </section>
  );
}
