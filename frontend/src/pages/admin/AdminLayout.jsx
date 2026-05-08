import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const tab = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition ${
      isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/admin" className="font-bold text-lg">Pedidos Rapidos</Link>
          <nav className="flex gap-2 ml-4">
            <NavLink to="/admin/orders" className={tab}>Pedidos</NavLink>
            <NavLink to="/admin/products" className={tab}>Productos</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:block text-slate-500">
              {user?.tenant?.name} - {user?.email}
            </span>
            <button onClick={onLogout} className="btn-secondary">Salir</button>
          </div>
        </div>
      </header>

      <main className="flex-1 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
