import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { superadminApi, setSuperSession } from '../../api/superadmin.js';
import ThemeToggle from '../../components/ThemeToggle.jsx';

export default function SuperAdminLoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await superadminApi.login(form.email, form.password);
      setSuperSession(result);
      navigate('/superAdmin', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ThemeToggle className="fixed top-2 left-2 z-50" />
      <div className="min-h-screen flex items-center justify-center px-4 bg-slate-900">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Panel del sistema</h1>
          <p className="text-sm text-slate-600 mt-1 dark:text-slate-300">
            Acceso exclusivo del dueno. Gestiona clientes, planes y vencimientos.
          </p>
        </div>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} required autoComplete="email"
                 placeholder="owner@pedidos.local"
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
        </form>
      </div>
    </>
  );
}
