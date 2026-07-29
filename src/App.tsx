import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AuthGate from './auth/AuthGate'
import { TimerProvider } from './timer/TimerContext'
import AppShell from './layout/AppShell'
import Dashboard from './pages/Dashboard'
import Stammdaten from './pages/Stammdaten'
import AgenturenList from './pages/agenturen/AgenturenList'
import AgenturDetail from './pages/agenturen/AgenturDetail'
import KundenList from './pages/kunden/KundenList'
import KundeDetail from './pages/kunden/KundeDetail'
import ProjekteList from './pages/projekte/ProjekteList'
import ProjektDetail from './pages/projekte/ProjektDetail'
import BewerbungenList from './pages/bewerbungen/BewerbungenList'
import BewerbungDetail from './pages/bewerbungen/BewerbungDetail'
import KvaList from './pages/kva/KvaList'
import KvaDetail from './pages/kva/KvaDetail'
import RechnungenList from './pages/rechnungen/RechnungenList'
import RechnungDetail from './pages/rechnungen/RechnungDetail'
import DeadlinesList from './pages/deadlines/DeadlinesList'
import FokusPage from './pages/fokus/FokusPage'
import ZeiterfassungPage from './pages/zeiterfassung/ZeiterfassungPage'
import StatistikenPage from './pages/statistiken/StatistikenPage'
import JahresuebersichtPage from './pages/steuer/JahresuebersichtPage'
import AusgabenList from './pages/ausgaben/AusgabenList'
import FinanzenPage from './pages/finanzen/FinanzenPage'

function App() {
  return (
    <AuthGate>
      <TimerProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stammdaten" element={<Stammdaten />} />
              <Route path="/agenturen" element={<AgenturenList />} />
              <Route path="/agenturen/:id" element={<AgenturDetail />} />
              <Route path="/kunden" element={<KundenList />} />
              <Route path="/kunden/:id" element={<KundeDetail />} />
              <Route path="/projekte" element={<ProjekteList />} />
              <Route path="/projekte/:id" element={<ProjektDetail />} />
              <Route path="/bewerbungen" element={<BewerbungenList />} />
              <Route path="/bewerbungen/:id" element={<BewerbungDetail />} />
              <Route path="/kva" element={<KvaList />} />
              <Route path="/kva/:id" element={<KvaDetail />} />
              <Route path="/rechnungen" element={<RechnungenList />} />
              <Route path="/rechnungen/:id" element={<RechnungDetail />} />
              <Route path="/deadlines" element={<DeadlinesList />} />
              <Route path="/fokus" element={<FokusPage />} />
              <Route path="/zeit" element={<ZeiterfassungPage />} />
              <Route path="/statistiken" element={<StatistikenPage />} />
              <Route path="/jahresuebersicht" element={<JahresuebersichtPage />} />
              <Route path="/ausgaben" element={<AusgabenList />} />
              <Route path="/finanzen" element={<FinanzenPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TimerProvider>
    </AuthGate>
  )
}

export default App
