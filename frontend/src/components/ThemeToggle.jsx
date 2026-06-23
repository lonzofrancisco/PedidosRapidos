import { useTheme } from '../hooks/useTheme.js';

/**
 * Botón flotante global de modo claro/oscuro. Vive fijo arriba a la izquierda en
 * todas las páginas.
 */
export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="fixed top-2 left-2 z-50 h-9 w-9 flex items-center justify-center rounded-full border border-slate-300 bg-white/90 text-base shadow-sm backdrop-blur hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-800"
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
