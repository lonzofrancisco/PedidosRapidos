import { formatMoney } from '../../utils/format.js';

export default function ProductCard({ product, currency, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="card p-4 text-left hover:shadow-md transition flex flex-col"
    >
      {product.image_url && (
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-32 object-cover rounded-lg mb-3"
        />
      )}
      <h3 className="font-semibold">{product.name}</h3>
      {product.description && (
        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{product.description}</p>
      )}
      <div className="mt-auto pt-3 flex items-center justify-between">
        <span className="font-semibold text-brand-600">{formatMoney(product.price, currency)}</span>
        <span className="text-xs text-slate-500">Personalizar</span>
      </div>
    </button>
  );
}
