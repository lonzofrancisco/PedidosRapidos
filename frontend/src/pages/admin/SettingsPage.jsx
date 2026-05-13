import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { tenantApi } from '../../api/tenant.js';

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

function PlanBanner({ tenant }) {
  const info = planInfo(tenant);
  if (!info) return null;
  const fmt = (d) => d?.toLocaleDateString();

  if (info.status === 'expired') {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
        <p className="font-semibold text-red-800">Tu plan expiró</p>
        <p className="text-sm text-red-700 mt-1">
          Tu tienda pública está temporalmente desactivada. Para reactivarla,
          contactá al soporte para abonar el plan mensual.
        </p>
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
      </div>
    );
  }
  return (
    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
      <p className="font-semibold text-emerald-900">Plan activo</p>
      <p className="text-sm text-emerald-800 mt-1">
        Próxima fecha de pago: {fmt(info.expiresAt)}.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { token } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState({ name: '', whatsapp_number: '', image_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await tenantApi.get(token);
      setTenant(data);
      setForm({
        name: data.name ?? '',
        whatsapp_number: data.whatsapp_number ?? '',
        image_url: data.image_url ?? '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

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

  if (loading) return <p className="text-slate-500">Cargando...</p>;

  return (
    <section className="max-w-2xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Tienda</h1>
        <p className="text-sm text-slate-600">
          Configura el logo y los datos publicos de tu tienda.
        </p>
      </div>

      <PlanBanner tenant={tenant} />

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

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </section>
  );
}
