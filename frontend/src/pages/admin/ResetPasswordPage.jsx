import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('t');
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', passwordConfirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  // Verify token on mount
  useEffect(() => {
    async function verify() {
      try {
        if (!token || !tenantSlug) {
          setError('Link inválido: faltan parámetros');
          setVerifying(false);
          return;
        }
        await authApi.verifyResetToken(token, tenantSlug);
        setVerified(true);
        setError(null);
      } catch (err) {
        setError(err.message || 'Link inválido o expirado');
      } finally {
        setVerifying(false);
      }
    }
    verify();
  }, [token, tenantSlug]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.passwordConfirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        token,
        tenant_slug: tenantSlug,
        password: form.password,
      });
      navigate('/admin/login?reset=ok');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <>
        <ThemeToggle className="fixed top-2 left-2 z-50" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-8 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Verificando link...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!verified || error) {
    return (
      <>
        <ThemeToggle className="fixed top-2 left-2 z-50" />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-8 space-y-4">
            <h1 className="text-2xl font-bold text-red-600">Link inválido</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {error || 'El link de recuperación ha expirado o es inválido.'}
            </p>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-sm text-center">
              <Link
                to="/admin/forgot-password"
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ← Solicitar un nuevo link
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
          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ingresa una nueva contraseña segura (mínimo 8 caracteres).
          </p>

          <div>
            <label className="label">Nueva contraseña</label>
            <input
              className="input"
              type="password"
              value={form.password}
              required
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Confirmar contraseña</label>
            <input
              className="input"
              type="password"
              value={form.passwordConfirm}
              required
              autoComplete="new-password"
              placeholder="Confirma tu contraseña"
              onChange={(e) =>
                setForm({ ...form, passwordConfirm: e.target.value })
              }
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
            {submitting ? 'Actualizando...' : 'Actualizar contraseña'}
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
