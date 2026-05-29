import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { APP_VERSION, APP_COMMIT } from '../lib/version'
import { useNovidades } from '../lib/use-novidades'

type NavItem = { label: string; to: string }
type NavGroup = { title: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: 'Cadastros',
    items: [
      { label: 'Municípios',    to: '/municipios' },
      { label: 'Inspetorias',   to: '/inspetorias' },
      { label: 'Delegacias',    to: '/delegacias' },
      { label: 'Participantes', to: '/participantes' },
      { label: 'Modalidades',   to: '/modalidades' },
      { label: 'Categorias',    to: '/categorias' },
    ],
  },
  {
    title: 'Competições',
    items: [
      { label: 'Edições', to: '/edicoes' },
      { label: 'Competições', to: '/competicoes' },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { temNovidade } = useNovidades()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-indigo-400 font-bold text-lg">⏸ ProSports</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="px-2 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-800 space-y-2">
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sair
          </button>
          <NavLink
            to="/novidades"
            className="flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <span>v{APP_VERSION} <span className="text-gray-600">({APP_COMMIT})</span></span>
            {temNovidade && (
              <span
                className="inline-block w-2 h-2 rounded-full bg-indigo-500"
                aria-label="Nova versão disponível"
              />
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
