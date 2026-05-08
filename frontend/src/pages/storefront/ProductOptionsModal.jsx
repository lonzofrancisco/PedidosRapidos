import { useMemo, useState } from 'react';
import { formatMoney } from '../../utils/format.js';

/**
 * Modal de personalizacion: muestra los grupos de opciones (cards dinamicas)
 * y construye el item del carrito con los precios calculados localmente.
 *
 * Tipos de grupo soportados:
 *   - single   : radio (1 opcion)
 *   - multi    : checkbox (varias opciones, qty=1 cada una)
 *   - quantity : empanada-style (cada opcion con su contador +/-)
 *
 * State: selected[groupId] = Map<optionId, quantity>
 *
 * El servidor recalcula los precios igualmente al crear el pedido.
 */
export default function ProductOptionsModal({ product, currency, onClose, onAdd }) {
  const [selected, setSelected] = useState(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const optionsTotal = useMemo(() => {
    let total = 0;
    for (const group of product.option_groups ?? []) {
      const sels = selected[group.id] ?? new Map();
      for (const opt of group.options) {
        const qty = sels.get(opt.id) ?? 0;
        if (qty > 0) total += Number(opt.price_delta) * qty;
      }
    }
    return total;
  }, [selected, product]);

  const unitPrice = Number(product.price) + optionsTotal;
  const error = validateSelection(product, selected);

  const setSelections = (groupId, mapper) => {
    setSelected(prev => {
      const next = { ...prev };
      const map = new Map(next[groupId] ?? []);
      mapper(map);
      next[groupId] = map;
      return next;
    });
  };

  const toggleSingle = (group, option) => {
    setSelections(group.id, (m) => { m.clear(); m.set(option.id, 1); });
  };

  const toggleMulti = (group, option) => {
    setSelections(group.id, (m) => {
      if (m.has(option.id)) m.delete(option.id);
      else if (totalQty(m) < group.max_select) m.set(option.id, 1);
    });
  };

  const incQty = (group, option) => {
    setSelections(group.id, (m) => {
      const current = m.get(option.id) ?? 0;
      if (totalQty(m) + 1 > group.max_select) return; // tope del grupo
      m.set(option.id, current + 1);
    });
  };

  const decQty = (group, option) => {
    setSelections(group.id, (m) => {
      const current = m.get(option.id) ?? 0;
      if (current <= 1) m.delete(option.id);
      else m.set(option.id, current - 1);
    });
  };

  const handleAdd = () => {
    if (error) return;
    const optionItems = [];
    const selections = [];
    for (const group of product.option_groups ?? []) {
      const sels = selected[group.id] ?? new Map();
      for (const opt of group.options) {
        const qty = sels.get(opt.id) ?? 0;
        if (qty > 0) {
          selections.push({ option_id: opt.id, quantity: qty });
          optionItems.push({
            option_id: opt.id,
            group_name: group.name,
            option_name: opt.name,
            price_delta: Number(opt.price_delta),
            quantity: qty,
          });
        }
      }
    }
    onAdd({
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity,
      selections,
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
          {(product.option_groups ?? []).map(group => {
            const sels = selected[group.id] ?? new Map();
            const sumQty = totalQty(sels);

            return (
              <fieldset key={group.id}>
                <legend className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                  {group.name}
                  {group.required && <span className="badge bg-red-100 text-red-700">Obligatorio</span>}
                  {group.type === 'multi' && (
                    <span className="text-xs text-slate-500 font-normal">Max {group.max_select}</span>
                  )}
                  {group.type === 'quantity' && (
                    <span className="text-xs text-slate-500 font-normal">
                      {sumQty} / {group.max_select} unidades
                    </span>
                  )}
                </legend>

                <div className="mt-2 space-y-1">
                  {group.options.map(opt => {
                    const qty = sels.get(opt.id) ?? 0;

                    if (group.type === 'quantity') {
                      return (
                        <div key={opt.id} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${qty > 0 ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{opt.name}</p>
                            {Number(opt.price_delta) > 0 && (
                              <p className="text-xs text-slate-500">{formatMoney(opt.price_delta, currency)} c/u</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decQty(group, opt)}
                              disabled={qty === 0}
                              className="btn-secondary px-2 py-1 disabled:opacity-30"
                            >-</button>
                            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                            <button
                              type="button"
                              onClick={() => incQty(group, opt)}
                              disabled={sumQty >= group.max_select}
                              className="btn-secondary px-2 py-1 disabled:opacity-30"
                            >+</button>
                          </div>
                        </div>
                      );
                    }

                    const checked = qty > 0;
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
                            onChange={() => group.type === 'single' ? toggleSingle(group, opt) : toggleMulti(group, opt)}
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
            );
          })}

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
              <button type="button" className="btn-secondary px-3"
                      onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
              <span className="w-8 text-center font-semibold">{quantity}</span>
              <button type="button" className="btn-secondary px-3"
                      onClick={() => setQuantity(q => Math.min(99, q + 1))}>+</button>
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

function totalQty(map) {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

function initialSelection(product) {
  const sel = {};
  for (const group of product.option_groups ?? []) {
    sel[group.id] = new Map();
    if (group.type === 'single' && group.required && group.options[0]) {
      sel[group.id].set(group.options[0].id, 1);
    }
  }
  return sel;
}

function validateSelection(product, selected) {
  for (const group of product.option_groups ?? []) {
    const sumQty = totalQty(selected[group.id] ?? new Map());
    if (group.required && sumQty < Math.max(group.min_select, 1)) {
      const noun = group.type === 'quantity' ? 'unidad' : 'opcion';
      return `Selecciona al menos 1 ${noun} en "${group.name}"`;
    }
    if (sumQty < group.min_select) {
      return `Selecciona al menos ${group.min_select} en "${group.name}"`;
    }
    if (sumQty > group.max_select) {
      return `Maximo ${group.max_select} en "${group.name}"`;
    }
  }
  return null;
}
