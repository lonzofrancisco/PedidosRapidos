import { useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { productsApi } from '../../api/products.js';

const MAX_IMAGES = 8;

// Tipos de grupo en lenguaje claro para el comerciante. `value` es lo que
// entiende el backend (single|multi|quantity); el resto es solo UI.
const TYPE_OPTIONS = [
  { value: 'single',   title: 'Elegí una',           hint: 'El cliente elige una sola. Ej: tamaño, color, voltaje.' },
  { value: 'multi',    title: 'Elegí varias',        hint: 'Puede elegir varias. Ej: extras, accesorios.' },
  { value: 'quantity', title: 'Cantidad por opción', hint: 'Pone una cantidad por cada opción. Ej: docena surtida, cantidad por medida.' },
];

/**
 * Crea o edita un producto (campos basicos + grupos de opciones).
 *
 * Grupos / opciones:
 *   - Cargados con su `id` real cuando vienen del backend.
 *   - Las que el usuario agrega aqui no tienen `id` -> el backend hace INSERT.
 *   - Las que el usuario quita y desaparecen del array -> el backend hace DELETE.
 *
 * Esa logica de diff vive en backend (replaceOptionGroups). El frontend solo
 * envia el array completo tal como quedo en pantalla.
 */
export default function ProductFormModal({ mode, product, onClose, onSaved }) {
  const { token } = useAuth();
  const isEdit = mode === 'edit';

  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    // Galeria: la primera imagen es la portada. Productos viejos pueden venir
    // solo con image_url -> lo metemos como primera de la galeria.
    image_urls: product?.image_urls ?? (product?.image_url ? [product.image_url] : []),
    active: product?.active ?? true,
  });

  const [groups, setGroups] = useState(() => normalizeGroups(product?.option_groups));
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const updateField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onPickFile = () => fileRef.current?.click();

  const onFilesChange = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permite reseleccionar los mismos archivos
    if (files.length === 0) return;

    const room = MAX_IMAGES - form.image_urls.length;
    if (room <= 0) {
      setError(`Máximo ${MAX_IMAGES} imágenes por producto.`);
      return;
    }
    const toUpload = files.slice(0, room);
    if (toUpload.some(f => f.size > 2 * 1024 * 1024)) {
      setError('Cada imagen debe pesar menos de 2 MB.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded = [];
      for (const file of toUpload) {
        const { image_url } = await productsApi.uploadImage(token, file);
        uploaded.push(image_url);
      }
      setForm(f => ({ ...f, image_urls: [...f.image_urls, ...uploaded] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImageAt = (idx) =>
    setForm(f => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== idx) }));

  // Reordena la galeria (dir = -1 izquierda, +1 derecha). La primera = portada.
  const moveImage = (idx, dir) =>
    setForm(f => {
      const j = idx + dir;
      if (j < 0 || j >= f.image_urls.length) return f;
      const next = [...f.image_urls];
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...f, image_urls: next };
    });

  const addGroup = () => setGroups(gs => [...gs, {
    id: undefined, name: '', type: 'single', required: false, min_select: 0, max_select: 1, options: [],
  }]);

  const updateGroup = (gi, patch) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, ...patch } : g));

  const removeGroup = (gi) => setGroups(gs => gs.filter((_, i) => i !== gi));

  const addOption = (gi) =>
    setGroups(gs => gs.map((g, i) =>
      i === gi ? { ...g, options: [...g.options, { id: undefined, name: '', price_delta: 0 }] } : g));

  const updateOption = (gi, oi, patch) =>
    setGroups(gs => gs.map((g, i) => {
      if (i !== gi) return g;
      return { ...g, options: g.options.map((o, j) => j === oi ? { ...o, ...patch } : o) };
    }));

  const removeOption = (gi, oi) =>
    setGroups(gs => gs.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validacion: rechazar grupos sin nombre o con opciones sin nombre.
    // Antes los filtraba silenciosamente, lo que hacia "desaparecer" filas
    // que el usuario llenaba parcialmente.
    for (const [gi, g] of groups.entries()) {
      if (!g.name.trim()) {
        setError(`El grupo #${gi + 1} no tiene nombre.`);
        return;
      }
      for (const [oi, o] of g.options.entries()) {
        if (!o.name.trim()) {
          setError(`La opcion #${oi + 1} del grupo "${g.name}" no tiene nombre.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        price: Number(form.price),
        image_urls: form.image_urls,
        active: form.active,
        option_groups: serializeGroups(groups),
      };

      if (isEdit) {
        await productsApi.update(token, product.id, payload);
      } else {
        await productsApi.create(token, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Evita que Enter dentro de un <input> dispare el submit del formulario:
  // hacia eso que el usuario perdiera filas a medio rellenar.
  const blockEnterSubmit = (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form
        onSubmit={submit}
        onKeyDown={blockEnterSubmit}
        className="bg-white w-full sm:max-w-2xl max-h-[95vh] rounded-t-2xl sm:rounded-2xl flex flex-col dark:bg-slate-800"
      >
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between dark:border-slate-700">
          <h2 className="font-bold">{isEdit ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none dark:text-slate-500 dark:hover:text-slate-300">&times;</button>
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
            <div className="flex items-center justify-between">
              <label className="label">Imágenes</label>
              <span className="text-xs text-slate-400 dark:text-slate-500">{form.image_urls.length}/{MAX_IMAGES}</span>
            </div>

            {form.image_urls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1">
                {form.image_urls.map((url, idx) => (
                  <div key={url} className="relative aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100 dark:border-slate-600 dark:bg-slate-700">
                    <img src={url} alt={`Imagen ${idx + 1}`} className="h-full w-full object-cover"
                         onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 badge bg-brand-600 text-white text-[10px] px-1.5 py-0.5">Portada</span>
                    )}
                    <button type="button" onClick={() => removeImageAt(idx)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center hover:bg-black/80"
                            aria-label="Quitar imagen">&times;</button>
                    <div className="absolute bottom-1 inset-x-1 flex justify-between">
                      <button type="button" onClick={() => moveImage(idx, -1)} disabled={idx === 0}
                              className="h-5 w-5 rounded bg-white/80 text-slate-700 text-sm leading-none flex items-center justify-center disabled:opacity-30 dark:bg-slate-900/70 dark:text-slate-200"
                              aria-label="Mover a la izquierda">&lsaquo;</button>
                      <button type="button" onClick={() => moveImage(idx, 1)} disabled={idx === form.image_urls.length - 1}
                              className="h-5 w-5 rounded bg-white/80 text-slate-700 text-sm leading-none flex items-center justify-center disabled:opacity-30 dark:bg-slate-900/70 dark:text-slate-200"
                              aria-label="Mover a la derecha">&rsaquo;</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn-secondary mt-2"
              disabled={uploading || form.image_urls.length >= MAX_IMAGES}
              onClick={onPickFile}
            >
              {uploading ? 'Subiendo...' : (form.image_urls.length > 0 ? '+ Agregar imágenes' : 'Subir imágenes')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={onFilesChange}
            />
            <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
              JPG, PNG, WEBP o GIF. Máximo 2 MB cada una. La primera es la portada (usá las flechas para reordenar).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active}
                   onChange={(e) => updateField('active', e.target.checked)} />
            Activo (visible en storefront)
          </label>

          <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Opciones del producto</h3>
              <button type="button" onClick={addGroup} className="btn-secondary text-xs">+ Agregar card</button>
            </div>

            {groups.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Opcional. Cada card es una elección que ve el cliente.
                Ej: "Medida" o "Color" (ferretería), "Tamaño" o "Extras" (comida).
              </p>
            )}

            <div className="space-y-3">
              {groups.map((g, gi) => (
                <div key={g.id ?? `new-${gi}`} className="border border-slate-200 rounded-lg p-3 space-y-2 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1" placeholder="Nombre de la card * (ej: Medida, Tamaño)" required
                           value={g.name} onChange={(e) => updateGroup(gi, { name: e.target.value })} />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input type="checkbox" checked={g.required}
                             onChange={(e) => updateGroup(gi, { required: e.target.checked })} />
                      Obligatorio
                    </label>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-1 dark:text-slate-300">¿Cómo elige el cliente?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {TYPE_OPTIONS.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => updateGroup(gi, { type: t.value })}
                          className={`text-center rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                            g.type === t.value
                              ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                      {TYPE_OPTIONS.find(t => t.value === g.type)?.hint}
                    </p>
                  </div>
                  {(g.type === 'multi' || g.type === 'quantity') && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        {g.type === 'quantity' ? 'Min total' : 'Min'}
                        <input className="input mt-1" type="number" min="0" value={g.min_select}
                               onChange={(e) => updateGroup(gi, { min_select: e.target.value })} />
                      </label>
                      <label className="text-xs">
                        {g.type === 'quantity' ? 'Max total' : 'Max'}
                        <input className="input mt-1" type="number" min="1" value={g.max_select}
                               onChange={(e) => updateGroup(gi, { max_select: e.target.value })} />
                      </label>
                    </div>
                  )}
                  {g.type === 'quantity' && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cada opcion tendra su propio contador en el storefront.
                      Min/Max se aplican a la cantidad TOTAL del grupo.
                    </p>
                  )}

                  <div className="space-y-1">
                    {g.options.length === 0 && (
                      <p className="text-xs text-slate-400 italic dark:text-slate-500">Sin opciones aun.</p>
                    )}
                    {g.options.map((o, oi) => (
                      <div key={o.id ?? `new-${oi}`} className="flex gap-2">
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

                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={() => addOption(gi)}
                      className="btn-secondary text-xs py-1"
                    >
                      + Agregar opcion
                    </button>
                    <button type="button" onClick={() => removeGroup(gi)} className="text-xs text-red-600 hover:underline">
                      Quitar card
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className={`text-sm text-red-600 min-h-[1.25rem] ${error ? '' : 'invisible'}`}>
            {error || ' '}
          </p>
        </div>

        <footer className="border-t border-slate-200 px-5 py-3 flex justify-end gap-2 dark:border-slate-700">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Guardando...' : (isEdit ? 'Guardar' : 'Crear')}
          </button>
        </footer>
      </form>
    </div>
  );
}

// Convierte la respuesta del API al formato editable del form (mantiene ids).
function normalizeGroups(apiGroups) {
  return (apiGroups ?? []).map(g => ({
    id: g.id,
    name: g.name ?? '',
    type: g.type ?? 'single',
    required: !!g.required,
    min_select: g.min_select ?? 0,
    max_select: g.max_select ?? 1,
    options: (g.options ?? []).map(o => ({
      id: o.id,
      name: o.name ?? '',
      price_delta: Number(o.price_delta ?? 0),
    })),
  }));
}

// Limpia y formatea los grupos para enviar al backend.
function serializeGroups(groups) {
  return groups
    .filter(g => g.name.trim())
    .map(g => ({
      ...(g.id ? { id: g.id } : {}),
      name: g.name.trim(),
      type: g.type,
      required: !!g.required,
      min_select: Number(g.min_select) || 0,
      max_select: Number(g.max_select) || 1,
      options: g.options
        .filter(o => o.name.trim())
        .map(o => ({
          ...(o.id ? { id: o.id } : {}),
          name: o.name.trim(),
          price_delta: Number(o.price_delta) || 0,
        })),
    }));
}
