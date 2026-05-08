import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../../api/auth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/admin';

  const [form, setForm] = useState({
    tenant_slug: 'burger-demo',
    email: 'admin@burger-demo.test',
    password: 'admin123',
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold">Panel admin</h1>
        <p className="text-sm text-slate-600">Ingresa con tus credenciales de tienda.</p>

        <div>
          <label className="label">Slug de tienda</label>
          <input className="input" value={form.tenant_slug} required
                 onChange={(e) => setForm({ ...form, tenant_slug: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} required
                 onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Contrasena</label>
          <input className="input" type="password" value={form.password} required
                 onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="pt-3 border-t border-slate-200 text-sm text-center">
          <Link to="/" className="text-slate-500 hover:text-slate-700">&larr; Volver al inicio</Link>
        </div>
      </form>
    </div>
  );
}
