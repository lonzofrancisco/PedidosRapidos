import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '../../api/products.js';
import { useCart } from '../../hooks/useCart.js';
import { formatMoney } from '../../utils/format.js';
import { isOpenNow } from '../../utils/store.js';
import ProductCard from './ProductCard.jsx';
import ProductOptionsModal from './ProductOptionsModal.jsx';
import CartDrawer from './CartDrawer.jsx';

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

function StoreLogo({ tenant }) {
  const initial = (tenant?.name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <div className="relative h-11 w-11 shrink-0 rounded-full overflow-hidden border border-slate-200 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center dark:border-slate-700 dark:from-slate-700 dark:to-slate-800">
      <span className="text-lg font-bold text-brand-500">{initial}</span>
      {tenant?.image_url && (
        <img
          src={tenant.image_url}
          alt={tenant.name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card overflow-hidden animate-pulse">
          <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700" />
          <div className="p-4 space-y-2">
            <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-700/60" />
            <div className="mt-4 h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StorefrontPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const cart = useCart(slug);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    productsApi.listPublic(slug)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-700">
          <div className="max-w-3xl mx-auto pl-4 pr-14 py-3 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
            <div className="h-5 w-40 rounded bg-slate-200 animate-pulse dark:bg-slate-700" />
          </div>
        </div>
        <main className="max-w-3xl mx-auto px-4 py-6"><SkeletonGrid /></main>
      </div>
    );
  }
  if (error) {
    return (
      <CenterMsg>
        <div className="text-center">
          <p className="text-slate-700 font-medium dark:text-slate-200">No pudimos cargar la tienda</p>
          <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">{error}</p>
        </div>
      </CenterMsg>
    );
  }

  const currency = data?.tenant?.currency ?? 'ARS';
  const products = data?.products ?? [];
  const bg = data?.tenant?.background_url;

  return (
    <div className={`min-h-screen pb-28 ${bg ? '' : 'bg-slate-50 dark:bg-slate-900'}`}>
      {bg && (
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <img src={bg} alt="" className="w-full h-full object-cover blur-sm scale-110" />
          <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/70" />
        </div>
      )}
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-700">
        <div className="max-w-3xl mx-auto pl-4 pr-14 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <StoreLogo tenant={data.tenant} />
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight truncate">{data.tenant.name}</h1>
              <p className="text-xs text-slate-400 truncate dark:text-slate-500">Pedí online y coordiná por WhatsApp</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-full hover:bg-slate-100 transition shrink-0 dark:hover:bg-slate-800"
            aria-label="Ver carrito"
          >
            <CartIcon className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            {cart.count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-brand-600 text-white text-xs font-semibold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </button>
        </div>
      </header>

      {!isOpenNow(data.tenant) && (
        <div className="bg-red-50 border-b border-red-200 dark:bg-red-900/20 dark:border-red-900">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Esta tienda está cerrada. Volvé más tarde.
            </p>
          </div>
        </div>
      )}

      {(data.tenant.shipping_cost > 0 || data.tenant.min_order_amount) && (
        <div className="bg-blue-50 border-b border-blue-200 dark:bg-blue-900/20 dark:border-blue-900">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="text-xs text-blue-800 space-y-1 dark:text-blue-300">
              {data.tenant.shipping_cost > 0 && (
                <p>Envío: {formatMoney(data.tenant.shipping_cost, currency)}</p>
              )}
              {data.tenant.min_order_amount && (
                <p>Mínimo de compra: {formatMoney(data.tenant.min_order_amount, currency)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center mb-3 dark:bg-slate-800">
              <CartIcon className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 font-medium dark:text-slate-300">Aún no hay productos</p>
            <p className="text-sm text-slate-400 mt-1 dark:text-slate-500">La tienda todavía no cargó su menú.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={currency}
                onSelect={() => setSelected(p)}
              />
            ))}
          </div>
        )}
      </main>

      {selected && (
        <ProductOptionsModal
          product={selected}
          currency={currency}
          onClose={() => setSelected(null)}
          onAdd={(item) => { cart.addItem(item); setSelected(null); setCartOpen(true); }}
        />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        currency={currency}
        tenant={data?.tenant}
        onCheckout={() => {
          setCartOpen(false);
          navigate(`/t/${slug}/checkout`);
        }}
      />

      {cart.count > 0 && !cartOpen && (
        <div className="fixed bottom-4 inset-x-0 px-4 z-20">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="max-w-3xl mx-auto flex w-full items-center justify-between gap-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-3.5 shadow-xl shadow-brand-600/30 transition animate-slide-up"
          >
            <span className="flex items-center gap-2 font-medium">
              <CartIcon className="h-5 w-5" />
              Ver carrito
              <span className="bg-white/25 rounded-full px-2 py-0.5 text-sm">{cart.count}</span>
            </span>
            <span className="font-bold">{formatMoney(cart.total, currency)}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function CenterMsg({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-900">
      <div className="text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  );
}
