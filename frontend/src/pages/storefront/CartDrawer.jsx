import { formatMoney } from '../../utils/format.js';

export default function CartDrawer({ open, onClose, cart, currency, onCheckout }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="ml-auto bg-white w-full max-w-md h-full flex flex-col shadow-xl relative">
        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold">Tu pedido</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {cart.items.length === 0 && (
            <p className="text-slate-500 text-sm py-8 text-center">El carrito esta vacio.</p>
          )}
          {cart.items.map(item => (
            <div key={item.uid} className="border-b border-slate-100 pb-4 last:border-0">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <p className="font-medium">{item.product_name}</p>
                  {item.options?.length > 0 && (
                    <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                      {item.options.map((o, i) => (
                        <li key={i}>- {o.group_name}: {o.option_name}</li>
                      ))}
                    </ul>
                  )}
                  {item.notes && (
                    <p className="text-xs italic text-slate-500 mt-1">Nota: {item.notes}</p>
                  )}
                </div>
                <div className="text-right text-sm font-semibold">
                  {formatMoney(item.unit_price * item.quantity, currency)}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn-secondary px-2 py-1 text-xs"
                        onClick={() => cart.setQuantity(item.uid, item.quantity - 1)}>-</button>
                <span className="text-sm w-6 text-center">{item.quantity}</span>
                <button className="btn-secondary px-2 py-1 text-xs"
                        onClick={() => cart.setQuantity(item.uid, item.quantity + 1)}>+</button>
                <button className="ml-auto text-xs text-red-600 hover:underline"
                        onClick={() => cart.removeItem(item.uid)}>Quitar</button>
              </div>
            </div>
          ))}
        </div>

        <footer className="border-t border-slate-200 px-5 py-4 space-y-3">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatMoney(cart.total, currency)}</span>
          </div>
          <button
            type="button"
            disabled={cart.items.length === 0}
            onClick={onCheckout}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar al checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
