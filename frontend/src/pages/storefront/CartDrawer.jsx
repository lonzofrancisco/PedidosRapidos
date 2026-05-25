import { formatMoney } from '../../utils/format.js';

function CartIcon({ className = 'h-6 w-6' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         className={className} aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function QtyStepper({ value, onDec, onInc }) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={onDec}
        className="h-8 w-8 flex items-center justify-center text-lg leading-none text-slate-600 hover:text-brand-600"
        aria-label="Quitar uno"
      >−</button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onInc}
        className="h-8 w-8 flex items-center justify-center text-lg leading-none text-slate-600 hover:text-brand-600"
        aria-label="Agregar uno"
      >+</button>
    </div>
  );
}

export default function CartDrawer({ open, onClose, cart, currency, onCheckout }) {
  if (!open) return null;
  const empty = cart.items.length === 0;

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <aside className="ml-auto bg-white w-full max-w-md h-full flex flex-col shadow-2xl relative animate-slide-in-right">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-lg">Tu pedido</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 text-2xl leading-none"
            aria-label="Cerrar"
          >&times;</button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {empty ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <CartIcon className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-slate-600 font-medium">Tu carrito está vacío</p>
              <p className="text-sm text-slate-400 mt-1">Agregá productos del menú para empezar.</p>
            </div>
          ) : (
            <ul className="px-5 py-4 space-y-4">
              {cart.items.map((item) => (
                <li key={item.uid} className="border-b border-slate-100 pb-4 last:border-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{item.product_name}</p>
                      {item.options?.length > 0 && (
                        <ul className="text-xs text-slate-500 mt-1 space-y-0.5">
                          {item.options.map((o, i) => (
                            <li key={i}>
                              {o.group_name}: {(o.quantity ?? 1) > 1 ? `${o.quantity}× ` : ''}{o.option_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.notes && (
                        <p className="text-xs italic text-slate-500 mt-1">Nota: {item.notes}</p>
                      )}
                    </div>
                    <div className="text-right text-sm font-semibold whitespace-nowrap">
                      {formatMoney(item.unit_price * item.quantity, currency)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <QtyStepper
                      value={item.quantity}
                      onDec={() => cart.setQuantity(item.uid, item.quantity - 1)}
                      onInc={() => cart.setQuantity(item.uid, item.quantity + 1)}
                    />
                    <button
                      className="text-xs text-slate-400 hover:text-red-600"
                      onClick={() => cart.removeItem(item.uid)}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-200 px-5 py-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-xl">{formatMoney(cart.total, currency)}</span>
          </div>
          <button
            type="button"
            disabled={empty}
            onClick={onCheckout}
            className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar al checkout
          </button>
          <p className="text-xs text-center text-slate-400">
            Coordinás pago y entrega con la tienda por WhatsApp.
          </p>
        </footer>
      </aside>
    </div>
  );
}
