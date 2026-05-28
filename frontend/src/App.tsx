import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import DelegacoesList from './pages/delegacoes/DelegacoesList'
import DelegacaoForm from './pages/delegacoes/DelegacaoForm'
import ModalidadesList from './pages/modalidades/ModalidadesList'
import ModalidadeForm from './pages/modalidades/ModalidadeForm'
import CategoriasList from './pages/categorias/CategoriasList'
import CategoriaForm from './pages/categorias/CategoriaForm'
import MunicipiosList from './pages/municipios/MunicipiosList'
import MunicipioForm from './pages/municipios/MunicipioForm'
import MunicipiosImport from './pages/municipios/MunicipiosImport'
import Novidades from './pages/Novidades'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/delegacoes" replace />} />
            <Route path="/delegacoes" element={<DelegacoesList />} />
            <Route path="/delegacoes/nova" element={<DelegacaoForm />} />
            <Route path="/delegacoes/:id/editar" element={<DelegacaoForm />} />
            <Route path="/modalidades" element={<ModalidadesList />} />
            <Route path="/modalidades/nova" element={<ModalidadeForm />} />
            <Route path="/modalidades/:id/editar" element={<ModalidadeForm />} />
            <Route path="/categorias" element={<CategoriasList />} />
            <Route path="/categorias/nova" element={<CategoriaForm />} />
            <Route path="/categorias/:id/editar" element={<CategoriaForm />} />
            <Route path="/municipios" element={<MunicipiosList />} />
            <Route path="/municipios/novo" element={<MunicipioForm />} />
            <Route path="/municipios/:id/editar" element={<MunicipioForm />} />
            <Route path="/municipios/importar" element={<MunicipiosImport />} />
            <Route path="/novidades" element={<Novidades />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
