import { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/auth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname || '/admin';
  const resetSuccess = searchParams.get('reset') === 'ok';

  const [form, setForm] = useState({
    tenant_slug: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await authApi.login(form);
      login(result);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ThemeToggle className="fixed top-2 left-2 z-50" />
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold">Panel admin</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">Ingresa con tus credenciales de tienda.</p>

        {resetSuccess && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              ✓ Contraseña actualizada. Inicia sesión con tu nueva contraseña.
            </p>
          </div>
        )}

        <div>
          <label className="label">Slug de tienda</label>
          <input className="input" value={form.tenant_slug} required autoComplete="off"
                 placeholder="mi-tienda"
                 onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} required autoComplete="email"
                 placeholder="vos@tu-tienda.com"
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Contrasena</label>
          <input className="input" type="password" value={form.password} required autoComplete="current-password"
                 onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
          {error || ' '}
        </p>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="pt-3 border-t border-slate-200 text-sm text-center dark:border-slate-700 space-y-2">
          <Link to="/admin/forgot-password" className="block text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ¿Olvidé mi contraseña?
          </Link>
          <Link to="/" className="block text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            &larr; Volver al inicio
          </Link>
        </div>
        </form>
      </div>
    </>
  );
}
