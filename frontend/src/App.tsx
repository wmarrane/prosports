import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ModalidadesList from './pages/modalidades/ModalidadesList'
import ModalidadeForm from './pages/modalidades/ModalidadeForm'
import CategoriasList from './pages/categorias/CategoriasList'
import CategoriaForm from './pages/categorias/CategoriaForm'
import MunicipiosList from './pages/municipios/MunicipiosList'
import MunicipioForm from './pages/municipios/MunicipioForm'
import MunicipiosImport from './pages/municipios/MunicipiosImport'
import Novidades from './pages/Novidades'
import InspetoriasList from './pages/inspetorias/InspetoriasList'
import InspetoriaForm from './pages/inspetorias/InspetoriaForm'
import DelegaciasList from './pages/delegacias/DelegaciasList'
import DelegaciaForm from './pages/delegacias/DelegaciaForm'
import ParticipantesList from './pages/participantes/ParticipantesList'
import ParticipanteForm from './pages/participantes/ParticipanteForm'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/participantes" replace />} />

            <Route path="/inspetorias" element={<InspetoriasList />} />
            <Route path="/inspetorias/novo" element={<InspetoriaForm />} />
            <Route path="/inspetorias/:id/editar" element={<InspetoriaForm />} />

            <Route path="/delegacias" element={<DelegaciasList />} />
            <Route path="/delegacias/nova" element={<DelegaciaForm />} />
            <Route path="/delegacias/:id/editar" element={<DelegaciaForm />} />

            <Route path="/participantes" element={<ParticipantesList />} />
            <Route path="/participantes/novo" element={<ParticipanteForm />} />
            <Route path="/participantes/:id/editar" element={<ParticipanteForm />} />

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
