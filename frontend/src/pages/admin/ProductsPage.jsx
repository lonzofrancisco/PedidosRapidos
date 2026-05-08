import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { productsApi } from '../../api/products.js';
import { formatMoney } from '../../utils/format.js';
import ProductFormModal from './ProductFormModal.jsx';

export default function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await productsApi.listAdmin(token);
      setProducts(data.products);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const onDelete = async (p) => {
    if (!confirm(`Eliminar "${p.name}"?`)) return;
    await productsApi.remove(token, p.id);
    refresh();
  };

  const onToggleActive = async (p) => {
    await productsApi.update(token, p.id, { active: !p.active });
    refresh();
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Productos</h1>
          <p className="text-sm text-slate-600">Gestiona el catalogo de tu tienda.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nuevo producto</button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Precio</th>
              <th className="px-4 py-2">Opciones</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 w-1"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando...</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Aun no hay productos.</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.name}</p>
                  {p.description && <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>}
                </td>
                <td className="px-4 py-3">{formatMoney(p.price)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {(p.option_groups ?? []).length} grupo(s)
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onToggleActive(p)}
                    className={`badge ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {p.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="text-brand-600 hover:underline text-xs mr-3">Editar</button>
                  <button onClick={() => onDelete(p)} className="text-red-600 hover:underline text-xs">Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {creating && (
        <ProductFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); refresh(); }}
        />
      )}
      {editing && (
        <ProductFormModal
          mode="edit"
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </section>
  );
}
