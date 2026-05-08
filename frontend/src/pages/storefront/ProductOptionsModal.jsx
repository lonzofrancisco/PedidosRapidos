import { useMemo, useState } from 'react';
import { formatMoney } from '../../utils/format.js';

/**
 * Modal de personalizacion: muestra los grupos de opciones (cards dinamicas)
 * y construye el item del carrito con los precios calculados localmente.
 *
 * El precio final se recalcula igualmente en el servidor al crear el pedido.
 */
export default function ProductOptionsModal({ product, currency, onClose, onAdd }) {
  // selected: { [groupId]: Set<optionId> }
  const [selected, setSelected] = useState(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const optionsTotal = useMemo(() => {
    let total = 0;
    for (const group of product.option_groups ?? []) {
      const ids = selected[group.id] ?? new Set();
      for (const opt of group.options) {
        if (ids.has(opt.id)) total += Number(opt.price_delta);
      }
    }
    return total;
  }, [selected, product]);

  const unitPrice = Number(product.price) + optionsTotal;
  const error = validateSelection(product, selected);

  const toggle = (group, option) => {
    setSelected(prev => {
      const next = { ...prev };
      const set = new Set(next[group.id] ?? []);
      if (group.type === 'single') {
        set.clear();
        set.add(option.id);
      } else {
        if (set.has(option.id)) set.delete(option.id);
        else if (set.size < group.max_select) set.add(option.id);
      }
      next[group.id] = set;
      return next;
    });
  };

  const handleAdd = () => {
    if (error) return;
    const optionItems = [];
    const optionIds = [];
    for (const group of product.option_groups ?? []) {
      const ids = selected[group.id] ?? new Set();
      for (const opt of group.options) {
        if (ids.has(opt.id)) {
          optionIds.push(opt.id);
          optionItems.push({
            option_id: opt.id,
            group_name: group.name,
            option_name: opt.name,
            price_delta: Number(opt.price_delta),
          });
        }
      }
    }
    onAdd({
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity,
      option_ids: optionIds,
      options: optionItems,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{product.name}</h2>
            {product.description && (
              <p className="text-sm text-slate-600 mt-0.5">{product.description}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none -mt-1">&times;</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          {(product.option_groups ?? []).map(group => (
            <fieldset key={group.id}>
              <legend className="font-semibold text-sm flex items-center gap-2">
                {group.name}
                {group.required && <span className="badge bg-red-100 text-red-700">Obligatorio</span>}
                {group.type === 'multi' && (
                  <span className="text-xs text-slate-500 font-normal">
                    Max {group.max_select}
                  </span>
                )}
              </legend>
              <div className="mt-2 space-y-1">
                {group.options.map(opt => {
                  const ids = selected[group.id] ?? new Set();
                  const checked = ids.has(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between border rounded-lg px-3 py-2 cursor-pointer transition ${
                        checked ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type={group.type === 'single' ? 'radio' : 'checkbox'}
                          name={`g-${group.id}`}
                          checked={checked}
                          onChange={() => toggle(group, opt)}
                          className="accent-brand-600"
                        />
                        <span className="text-sm">{opt.name}</span>
                      </span>
                      {Number(opt.price_delta) > 0 && (
                        <span className="text-sm text-slate-600">
                          + {formatMoney(opt.price_delta, currency)}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              className="input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sin cebolla, termino bien cocido, etc."
            />
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
              >-</button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button
                type="button"
                className="btn-secondary px-3"
                onClick={() => setQuantity(q => Math.min(99, q + 1))}
              >+</button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!!error}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar - {formatMoney(unitPrice * quantity, currency)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function initialSelection(product) {
  const sel = {};
  for (const group of product.option_groups ?? []) {
    sel[group.id] = new Set();
    // si es single + required, preselecciona la primera para evitar estados invalidos
    if (group.type === 'single' && group.required && group.options[0]) {
      sel[group.id].add(group.options[0].id);
    }
  }
  return sel;
}

function validateSelection(product, selected) {
  for (const group of product.option_groups ?? []) {
    const count = (selected[group.id] ?? new Set()).size;
    if (group.required && count < Math.max(group.min_select, 1)) {
      return `Selecciona una opcion en "${group.name}"`;
    }
    if (count < group.min_select) {
      return `Selecciona al menos ${group.min_select} en "${group.name}"`;
    }
    if (count > group.max_select) {
      return `Maximo ${group.max_select} en "${group.name}"`;
    }
  }
  return null;
}
