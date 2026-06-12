import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
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
import SistemasDisputa from './pages/sistemas-disputa/SistemasDisputa'
import Painel from './pages/Painel'
import EventosList from './pages/eventos/EventosList'
import EventoForm from './pages/eventos/EventoForm'
import EventoInscricoes from './pages/eventos/EventoInscricoes'
import Relatorio from './pages/Relatorio'
import RelatorioCongresso from './pages/RelatorioCongresso'
import Admin from './pages/Admin'
import ModoCongresso from './pages/congresso/ModoCongresso'
import UsuariosList from './pages/usuarios/UsuariosList'
import UsuarioForm from './pages/usuarios/UsuarioForm'
import MinhaConta from './pages/conta/MinhaConta'
import TrocarSenha from './pages/conta/TrocarSenha'
import MobileLogin from './pages/mobile/MobileLogin'
import MobileModalidades from './pages/mobile/MobileModalidades'
import MobileModalidade from './pages/mobile/MobileModalidade'
import GlobalLoadingBar from './components/GlobalLoadingBar'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <GlobalLoadingBar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/e/:token" element={<MobileLogin />} />
        <Route path="/m" element={<MobileModalidades />} />
        <Route path="/m/:id" element={<MobileModalidade />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/congresso" element={<ModoCongresso />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/painel" replace />} />

            <Route path="/eventos"                  element={<EventosList />} />
            <Route path="/eventos/novo"             element={<EventoForm />} />
            <Route path="/eventos/:id/editar"       element={<EventoForm />} />
            <Route path="/eventos/:id/inscricoes"   element={<EventoInscricoes />} />
            <Route path="/relatorio" element={<Relatorio />} />
            <Route path="/relatorios/congresso" element={<RelatorioCongresso />} />

            {/* Rotas administrativas: barradas para COMISSAO_TECNICA */}
            <Route element={<ProtectedRoute roles={['ADMIN', 'PARTICIPANTE', 'VIEWER']} />}>
              <Route path="/painel"    element={<Painel />} />
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
            </Route>

            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/sistemas-disputa" element={<SistemasDisputa />} />
            </Route>

            <Route path="/novidades" element={<Novidades />} />

            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/usuarios" element={<UsuariosList />} />
              <Route path="/usuarios/novo" element={<UsuarioForm />} />
              <Route path="/usuarios/:id/editar" element={<UsuarioForm />} />
            </Route>

            <Route path="/conta" element={<MinhaConta />} />
            <Route path="/conta/senha" element={<TrocarSenha />} />

            <Route path="/sem-acesso" element={
              <div className="p-10 text-[var(--t1)]">
                <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
                <p className="text-[var(--t3)]">Você não tem permissão para acessar essa área.</p>
              </div>
            } />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
