import { formatMoney } from '../../utils/format.js';

export default function ProductCard({ product, currency, onSelect }) {
  const hasOptions = (product.option_groups?.length ?? 0) > 0;
  const initial = (product.name?.trim()?.[0] ?? '?').toUpperCase();
  // Portada: primera de la galeria, con fallback al image_url historico.
  const cover = product.image_urls?.[0] ?? product.image_url;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="card overflow-hidden text-left flex flex-col group transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {/* Imagen con placeholder detras (la inicial se ve si no hay foto o falla) */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-slate-100 overflow-hidden dark:from-slate-700 dark:to-slate-800">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-black text-brand-200 select-none dark:text-slate-600">{initial}</span>
        </div>
        {cover && (
          <img
            src={cover}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold leading-snug text-slate-900 dark:text-slate-100">{product.name}</h3>
        {product.description && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-2 dark:text-slate-400">{product.description}</p>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <span className="block font-bold text-lg text-slate-900 dark:text-slate-100">
              {formatMoney(product.price, currency)}
            </span>
            {hasOptions && (
              <span className="text-xs text-slate-400 dark:text-slate-500">Personalizable</span>
            )}
          </div>
          <span
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl leading-none shadow-sm group-hover:bg-brand-700 group-hover:scale-110 transition"
          >
            +
          </span>
        </div>
      </div>
    </button>
  );
}
