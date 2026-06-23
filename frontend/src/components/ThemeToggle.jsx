import { useTheme } from '../hooks/useTheme.js';

export default function ThemeToggle({ className = "fixed top-2 left-2 z-50" }) {
  const { isDark, toggle } = useTheme();
  const baseClasses = "h-9 w-9 flex items-center justify-center rounded-full border border-slate-300 bg-white/90 text-base shadow-sm backdrop-blur hover:bg-white dark:border-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-800";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={`${className} ${baseClasses}`}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
