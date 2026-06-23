import { useEffect, useState } from 'react';

const KEY = 'pedidos:theme';

// Lee el tema inicial: preferencia guardada > preferencia del SO > claro.
function getInitial() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function apply(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/**
 * Maneja el modo claro/oscuro: aplica la clase `dark` al <html> (que es lo que
 * usan las variantes dark: de Tailwind) y persiste la preferencia. El flash
 * inicial ya lo evita el script inline de index.html.
 */
export function useTheme() {
  const [theme, setTheme] = useState(getInitial);

  useEffect(() => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle, isDark: theme === 'dark' };
}
