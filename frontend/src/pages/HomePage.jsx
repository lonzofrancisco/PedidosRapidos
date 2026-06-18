import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  const onSubmit = (e) => {
    e.preventDefault();
    if (slug.trim()) navigate(`/t/${slug.trim()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8">
        <h1 className="text-2xl font-bold mb-2">Pedidos Rapidos</h1>
        <p className="text-slate-600 mb-6 text-sm">
          SaaS multi-tenant para tomar pedidos. Ingresa el slug de la tienda para ver el catalogo.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Tienda (slug)</label>
            <input
              className="input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="burger-demo"
            />
          </div>
          <button type="submit" className="btn-primary w-full">Entrar</button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200 space-y-3 text-sm text-slate-600">
          <div className="rounded-lg bg-brand-50 border border-brand-100 p-3">
            <p className="font-medium text-slate-800">¿Querés crear tu tienda?</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Probá <strong>15 días gratis</strong>. Sin tarjeta.
            </p>
            <Link
              to="/signup"
              className="btn-primary w-full mt-3 inline-flex justify-center"
            >
              Crear mi tienda
            </Link>
          </div>

          <div className="text-center">
            ¿Eres administrador?{' '}
            <Link to="/admin/login" className="text-brand-600 font-medium hover:underline">
              Iniciá sesión
            </Link>
          </div>

          <div className="text-center text-xs text-slate-400">
            <Link to="/terminos" className="hover:underline">Términos</Link>
            {' · '}
            <Link to="/privacidad" className="hover:underline">Privacidad</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
