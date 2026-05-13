import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '../../api/products.js';
import { useCart } from '../../hooks/useCart.js';
import { formatMoney } from '../../utils/format.js';
import ProductCard from './ProductCard.jsx';
import ProductOptionsModal from './ProductOptionsModal.jsx';
import CartDrawer from './CartDrawer.jsx';

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

  if (loading) return <CenterMsg>Cargando catalogo...</CenterMsg>;
  if (error)   return <CenterMsg>{error}</CenterMsg>;

  const currency = data?.tenant?.currency ?? 'ARS';

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{data.tenant.name}</h1>
            <p className="text-xs text-slate-500">@{data.tenant.slug}</p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="btn-primary relative"
          >
            Carrito
            {cart.count > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                {cart.count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {data.products.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Aun no hay productos disponibles.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.products.map(p => (
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
        onCheckout={() => {
          setCartOpen(false);
          navigate(`/t/${slug}/checkout`);
        }}
      />

      {cart.count > 0 && !cartOpen && (
        <div className="fixed bottom-4 inset-x-0 px-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="max-w-3xl mx-auto block w-full btn-primary py-3 text-base shadow-lg"
          >
            Ver carrito ({cart.count}) - {formatMoney(cart.total, currency)}
          </button>
        </div>
      )}
    </div>
  );
}

function CenterMsg({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-slate-600">{children}</p>
    </div>
  );
}
