import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    tenant_slug: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword({
        email: form.email,
        tenant_slug: form.tenant_slug,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <>
        <ThemeToggle className="fixed top-2 left-2 z-50" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-8 space-y-4">
            <div className="text-center space-y-4">
              <div className="text-5xl">📧</div>
              <h1 className="text-2xl font-bold">Revisa tu email</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Si la cuenta existe, recibirás un link para recuperar tu contraseña.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El link expira en 30 minutos.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-sm text-center">
              <Link
                to="/admin/login"
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ← Volver al login
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ThemeToggle className="fixed top-2 left-2 z-50" />
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-4">
          <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ingresa tu email y slug de tienda para recuperar tu contraseña.
          </p>

          <div>
            <label className="label">Slug de tienda</label>
            <input
              className="input"
              value={form.tenant_slug}
              required
              autoComplete="off"
              placeholder="mi-tienda"
              onChange={(e) =>
                setForm({ ...form, tenant_slug: e.target.value })
              }
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              required
              autoComplete="email"
              placeholder="vos@tu-tienda.com"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
            {error || ' '}
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar link'}
          </button>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-sm text-center">
            <Link
              to="/admin/login"
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Volver al login
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
