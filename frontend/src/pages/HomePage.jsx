import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [slug, setSlug] = useState('burger-demo');
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

        <div className="mt-6 pt-6 border-t border-slate-200 text-sm text-slate-600">
          Eres administrador?{' '}
          <Link to="/admin/login" className="text-brand-600 font-medium hover:underline">
            Inicia sesion aqui
          </Link>
        </div>
      </div>
    </div>
  );
}
