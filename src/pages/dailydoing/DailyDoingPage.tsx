import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProjekteList from '../projekte/ProjekteList'
import ZeiterfassungPage from '../zeiterfassung/ZeiterfassungPage'
import FokusPage from '../fokus/FokusPage'
import BewerbungenList from '../bewerbungen/BewerbungenList'

type Tab = 'projekte' | 'zeit' | 'fokus' | 'bewerbungen'

const TABS: { key: Tab; label: string }[] = [
  { key: 'projekte', label: 'Projekte' },
  { key: 'zeit', label: 'Zeiterfassung' },
  { key: 'fokus', label: 'Fokus & To-Do' },
  { key: 'bewerbungen', label: 'Bewerbungen' },
]

function istTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value)
}

// Bündelt die Bereiche des täglichen Arbeitens (bisher einzeln über
// "Projekte" erreichbar bzw. verstreut) unter einem gemeinsamen Bottom-Nav-
// Eintrag. Jeder Tab rendert die jeweils bestehende, unveränderte Seite —
// keine Logik dupliziert. Der Start-Tab kann per "?tab=zeit" o.ä. vorgewählt
// werden (siehe Homescreen-Widgets, die gezielt auf einen Tab verlinken).
export default function DailyDoingPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(istTab(initialTab) ? initialTab : 'projekte')

  return (
    <div>
      <div className="tab-bar" style={{ marginTop: 'var(--s2)' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'projekte' && <ProjekteList />}
      {tab === 'zeit' && <ZeiterfassungPage />}
      {tab === 'fokus' && <FokusPage />}
      {tab === 'bewerbungen' && <BewerbungenList />}
    </div>
  )
}
