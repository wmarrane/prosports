import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => setCollapsed((v) => !v)

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Topbar onToggleCollapse={toggle} />
        <div className="page-body" style={{ flex: 1, overflow: 'auto', color: 'var(--t1)' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
