import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signupApi } from '../api/signup.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const TRIAL_DAYS = 15;

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({
    tenant_name: '',
    slug: '',
    whatsapp_number: '',
    admin_email: '',
    admin_password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Sugerir slug a partir del nombre de la tienda mientras el usuario no
  // haya tocado el campo manualmente.
  const onTenantName = (e) => {
    const name = e.target.value;
    const auto = name
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
    setForm((f) => ({
      ...f,
      tenant_name: name,
      slug: f._slugTouched ? f.slug : auto,
    }));
  };

  const onSlug = (e) => {
    setForm({ ...form, slug: e.target.value.toLowerCase(), _slugTouched: true });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!slugRegex.test(form.slug)) {
      setError('El slug solo admite minusculas, numeros y guiones (no al principio/fin).');
      return;
    }
    if (form.admin_password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        tenant_name: form.tenant_name,
        slug: form.slug,
        whatsapp_number: form.whatsapp_number,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
      };
      const result = await signupApi.create(payload);
      login({ token: result.token, user: result.user });
      navigate('/admin/settings', { replace: true });
    } catch (err) {
      setError(err.message || 'No pudimos crear la tienda.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card max-w-lg w-full p-8">
        <h1 className="text-2xl font-bold mb-1">Creá tu tienda</h1>
        <p className="text-sm text-slate-600 mb-6">
          Probá gratis por <strong>{TRIAL_DAYS} días</strong>. Sin tarjeta.
          Después del periodo de prueba pasás al plan mensual.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre de la tienda</label>
            <input className="input" required value={form.tenant_name} onChange={onTenantName} placeholder="Burger Joe" />
          </div>

          <div>
            <label className="label">Slug público</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">/t/</span>
              <input
                className="input"
                required
                value={form.slug}
                onChange={onSlug}
                placeholder="burger-joe"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tus clientes van a entrar a <code>/t/{form.slug || 'tu-slug'}</code>.
            </p>
          </div>

          <div>
            <label className="label">WhatsApp (con código de país, sin "+")</label>
            <input
              className="input"
              required
              value={form.whatsapp_number}
              onChange={set('whatsapp_number')}
              placeholder="5491112345678"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="label">Tu email (admin)</label>
            <input className="input" required type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="vos@tutienda.com" />
          </div>

          <div>
            <label className="label">Contraseña (mínimo 8 caracteres)</label>
            <input className="input" required type="password" value={form.admin_password} onChange={set('admin_password')} minLength={8} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
            {submitting ? 'Creando...' : 'Crear mi tienda gratis'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 text-sm text-slate-600 text-center">
          ¿Ya tenés una tienda?{' '}
          <Link to="/admin/login" className="text-brand-600 font-medium hover:underline">
            Iniciá sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
