import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ModalidadesList from './pages/modalidades/ModalidadesList'
import ModalidadeForm from './pages/modalidades/ModalidadeForm'
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
import TiposModalidadeList from './pages/tipos-modalidade/TiposModalidadeList'
import TipoModalidadeForm from './pages/tipos-modalidade/TipoModalidadeForm'
import CompeticoesList from './pages/competicoes/CompeticoesList'
import CompeticaoForm from './pages/competicoes/CompeticaoForm'
import Painel from './pages/Painel'
import Eventos from './pages/Eventos'
import Relatorio from './pages/Relatorio'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/painel" replace />} />

            <Route path="/painel"    element={<Painel />} />
            <Route path="/eventos"   element={<Eventos />} />
            <Route path="/relatorio" element={<Relatorio />} />
            <Route path="/admin"     element={<Admin />} />

            <Route path="/inspetorias" element={<InspetoriasList />} />
            <Route path="/inspetorias/novo" element={<InspetoriaForm />} />
            <Route path="/inspetorias/:id/editar" element={<InspetoriaForm />} />

            <Route path="/delegacias" element={<DelegaciasList />} />
            <Route path="/delegacias/nova" element={<DelegaciaForm />} />
            <Route path="/delegacias/:id/editar" element={<DelegaciaForm />} />

            <Route path="/participantes" element={<ParticipantesList />} />
            <Route path="/participantes/novo" element={<ParticipanteForm />} />
            <Route path="/participantes/:id/editar" element={<ParticipanteForm />} />

            <Route path="/tipos-modalidade"            element={<TiposModalidadeList />} />
            <Route path="/tipos-modalidade/novo"       element={<TipoModalidadeForm />} />
            <Route path="/tipos-modalidade/:id/editar" element={<TipoModalidadeForm />} />

            <Route path="/modalidades" element={<ModalidadesList />} />
            <Route path="/modalidades/nova" element={<ModalidadeForm />} />
            <Route path="/modalidades/:id/editar" element={<ModalidadeForm />} />

            <Route path="/municipios" element={<MunicipiosList />} />
            <Route path="/municipios/novo" element={<MunicipioForm />} />
            <Route path="/municipios/:id/editar" element={<MunicipioForm />} />
            <Route path="/municipios/importar" element={<MunicipiosImport />} />

            <Route path="/competicoes" element={<CompeticoesList />} />
            <Route path="/competicoes/nova" element={<CompeticaoForm />} />
            <Route path="/competicoes/:id/editar" element={<CompeticaoForm />} />

            <Route path="/novidades" element={<Novidades />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
