import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { productsApi } from '../../api/products.js';

/**
 * Crea o edita un producto.
 *
 * En modo "create" permite definir grupos de opciones (cards) y opciones,
 * que llegan al endpoint POST /admin/products en un solo payload.
 *
 * En modo "edit" solo se pueden ajustar los campos basicos del producto;
 * la edicion de grupos/opciones se haria con endpoints dedicados (TODO).
 */
export default function ProductFormModal({ mode, product, onClose, onSaved }) {
  const { token } = useAuth();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    image_url: product?.image_url ?? '',
    active: product?.active ?? true,
  });

  const [groups, setGroups] = useState([]); // solo en create
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addGroup = () => setGroups(gs => [...gs, {
    name: '', type: 'single', required: false, min_select: 0, max_select: 1, options: [],
  }]);

  const updateGroup = (gi, patch) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, ...patch } : g));

  const removeGroup = (gi) => setGroups(gs => gs.filter((_, i) => i !== gi));

  const addOption = (gi) =>
    setGroups(gs => gs.map((g, i) =>
      i === gi ? { ...g, options: [...g.options, { name: '', price_delta: 0 }] } : g));

  const updateOption = (gi, oi, patch) =>
    setGroups(gs => gs.map((g, i) => {
      if (i !== gi) return g;
      return { ...g, options: g.options.map((o, j) => j === oi ? { ...o, ...patch } : o) };
    }));

  const removeOption = (gi, oi) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await productsApi.update(token, product.id, {
          name: form.name,
          description: form.description || undefined,
          price: Number(form.price),
          image_url: form.image_url || undefined,
          active: form.active,
        });
      } else {
        await productsApi.create(token, {
          name: form.name,
          description: form.description || undefined,
          price: Number(form.price),
          image_url: form.image_url || undefined,
          active: form.active,
          option_groups: groups
            .filter(g => g.name.trim() && g.options.length > 0)
            .map(g => ({
              name: g.name.trim(),
              type: g.type,
              required: g.required,
              min_select: Number(g.min_select),
              max_select: Number(g.max_select),
              options: g.options
                .filter(o => o.name.trim())
                .map(o => ({ name: o.name.trim(), price_delta: Number(o.price_delta) || 0 })),
            })),
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form onSubmit={submit} className="bg-white w-full sm:max-w-2xl max-h-[95vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" required value={form.name}
                     onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Precio base *</label>
              <input className="input" type="number" min="0" step="0.01" required value={form.price}
                     onChange={(e) => updateField('price', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Descripcion</label>
            <textarea className="input" rows={2} value={form.description}
                      onChange={(e) => updateField('description', e.target.value)} />
          </div>
          <div>
            <label className="label">URL de imagen</label>
            <input className="input" type="url" value={form.image_url}
                   onChange={(e) => updateField('image_url', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active}
                   onChange={(e) => updateField('active', e.target.checked)} />
            Activo (visible en storefront)
          </label>

          {!isEdit && (
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Grupos de opciones (cards)</h3>
                <button type="button" onClick={addGroup} className="btn-secondary text-xs">+ Grupo</button>
              </div>

              {groups.length === 0 && (
                <p className="text-xs text-slate-500">Opcional. Agrega grupos como "Tamano" o "Extras".</p>
              )}

              <div className="space-y-3">
                {groups.map((g, gi) => (
                  <div key={gi} className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <input className="input" placeholder="Nombre del grupo"
                             value={g.name} onChange={(e) => updateGroup(gi, { name: e.target.value })} />
                      <select className="input" value={g.type}
                              onChange={(e) => updateGroup(gi, { type: e.target.value })}>
                        <option value="single">Single (radio)</option>
                        <option value="multi">Multi (checkbox)</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={g.required}
                               onChange={(e) => updateGroup(gi, { required: e.target.checked })} />
                        Obligatorio
                      </label>
                    </div>
                    {g.type === 'multi' && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs">
                          Min
                          <input className="input mt-1" type="number" min="0" value={g.min_select}
                                 onChange={(e) => updateGroup(gi, { min_select: e.target.value })} />
                        </label>
                        <label className="text-xs">
                          Max
                          <input className="input mt-1" type="number" min="1" value={g.max_select}
                                 onChange={(e) => updateGroup(gi, { max_select: e.target.value })} />
                        </label>
                      </div>
                    )}

                    <div className="space-y-1">
                      {g.options.map((o, oi) => (
                        <div key={oi} className="flex gap-2">
                          <input className="input flex-1" placeholder="Opcion (ej: Doble)"
                                 value={o.name}
                                 onChange={(e) => updateOption(gi, oi, { name: e.target.value })} />
                          <input className="input w-28" type="number" step="0.01" placeholder="+ extra"
                                 value={o.price_delta}
                                 onChange={(e) => updateOption(gi, oi, { price_delta: e.target.value })} />
                          <button type="button" className="text-red-600 text-xs px-2"
                                  onClick={() => removeOption(gi, oi)}>X</button>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-between">
                      <button type="button" onClick={() => addOption(gi)} className="text-xs text-brand-600">+ opcion</button>
                      <button type="button" onClick={() => removeGroup(gi)} className="text-xs text-red-600">Quitar grupo</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <footer className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : (isEdit ? 'Guardar' : 'Crear')}
          </button>
        </footer>
      </form>
    </div>
  );
}
