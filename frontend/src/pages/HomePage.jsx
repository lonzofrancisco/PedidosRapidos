import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle.jsx';
import heroImage from '../assets/hero-delivery.png';

const FEATURES = [
  {
    icon: '🛒',
    title: 'Catálogo online',
    desc: 'Subí tus productos con fotos y precios. Tu tienda lista en minutos, sin programar nada.',
  },
  {
    icon: '💬',
    title: 'Pedidos por WhatsApp',
    desc: 'Tus clientes arman el pedido y te llega directo al WhatsApp, listo para confirmar.',
  },
  {
    icon: '📊',
    title: 'Panel de administración',
    desc: 'Gestioná pedidos, productos y estados de entrega desde un panel simple y rápido.',
  },
  {
    icon: '📈',
    title: 'Reportes de ventas',
    desc: 'Mirá cuánto vendés por día, tus productos más pedidos y el estado de tu negocio.',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Creá tu tienda gratis',
    desc: 'Registrate en 2 minutos, elegí el nombre de tu negocio y tu link público.',
  },
  {
    n: '2',
    title: 'Cargá tu catálogo',
    desc: 'Agregá tus productos con precio, foto y descripción desde el panel.',
  },
  {
    n: '3',
    title: 'Compartí tu link',
    desc: 'Enviá tu link a tus clientes y empezá a recibir pedidos al instante.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <ThemeToggle />

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-40 backdrop-blur bg-white/80 border-b border-slate-200 dark:bg-slate-900/80 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-100 pl-11">Pedidos Rápidos</span>
          <nav className="flex items-center gap-2">
            <Link to="/admin/login" className="text-sm text-slate-600 hover:text-brand-600 dark:text-slate-300 px-3 py-2">
              Iniciar sesión
            </Link>
            <Link to="/signup" className="btn-primary text-sm">
              Crear mi tienda
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative pt-14 min-h-[600px] flex items-center bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/75 to-slate-900/40" />
        <div className="relative max-w-6xl mx-auto px-4 py-24 w-full">
          <div className="max-w-xl">
            <span className="badge bg-brand-500/20 text-brand-100 border border-brand-400/30 mb-4">
              15 días gratis · Sin tarjeta
            </span>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
              Tu tienda online, lista para recibir pedidos hoy
            </h1>
            <p className="text-slate-200 text-base sm:text-lg mb-8">
              La forma más simple de vender por WhatsApp: catálogo, pedidos y panel de
              administración en un solo lugar, para tu negocio.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/signup" className="btn-primary px-6 py-3 text-base">
                Crear mi tienda gratis
              </Link>
              <Link to="/admin/login" className="btn-secondary px-6 py-3 text-base bg-white/10 text-white border-white/30 hover:bg-white/20">
                Ya tengo una tienda
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
            Todo lo que necesitás para vender online
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Sin instalar nada, sin conocimientos técnicos. Empezá a tomar pedidos el mismo día.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 dark:bg-slate-800/40 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
              Empezá a vender en 3 pasos
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="card p-10 text-center bg-brand-50 border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
            Probá 15 días gratis, sin tarjeta
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-xl mx-auto">
            Al terminar el período de prueba pasás a un plan mensual simple. Cancelá cuando quieras.
          </p>
          <Link to="/signup" className="btn-primary px-8 py-3 text-base inline-flex">
            Crear mi tienda gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>© {new Date().getFullYear()} Pedidos Rápidos</span>
          <div className="flex items-center gap-4">
            <Link to="/terminos" className="hover:underline">Términos</Link>
            <Link to="/privacidad" className="hover:underline">Privacidad</Link>
            <Link to="/admin/login" className="hover:underline">Iniciar sesión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
