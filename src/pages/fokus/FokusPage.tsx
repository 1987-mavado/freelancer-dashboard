import { useEffect, useRef, useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { todosRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import GoogleCalendarWidget from './GoogleCalendarWidget'

const FOCUS_SECONDS = 25 * 60
const BREAK_SECONDS = 5 * 60

function useTimer() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            const nextMode = mode === 'focus' ? 'break' : 'focus'
            if (mode === 'focus') setRounds((r) => r + 1)
            setMode(nextMode)
            return nextMode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS
          }
          return s - 1
        })
      }, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running, mode])

  function reset() {
    setRunning(false)
    setMode('focus')
    setSecondsLeft(FOCUS_SECONDS)
    setRounds(0)
  }

  return { mode, secondsLeft, running, setRunning, rounds, reset }
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

export default function FokusPage() {
  const { mode, secondsLeft, running, setRunning, rounds, reset } = useTimer()
  const todos = useSupabaseQuery(
    ['todos'],
    async () => {
      const rows = await todosRepo.list()
      rows.sort((a, b) => (a.erstelltAm > b.erstelltAm ? 1 : a.erstelltAm < b.erstelltAm ? -1 : 0))
      rows.reverse()
      return rows
    },
    [],
  )
  const [text, setText] = useState('')

  async function addTodo() {
    if (!text.trim()) return
    await todosRepo.add({ text: text.trim(), erledigt: false, erstelltAm: new Date().toISOString() })
    setText('')
  }

  async function toggleTodo(id?: number, erledigt?: boolean) {
    if (!id) return
    await todosRepo.update(id, { erledigt: !erledigt })
  }

  async function deleteTodo(id?: number) {
    if (!id) return
    await todosRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Fokus &amp; To-Do" back={false} />

      <div className="card">
        <div className="timer-mode">{mode === 'focus' ? 'Fokus' : 'Pause'} · Runde {rounds}</div>
        <div className="timer-display">{formatTime(secondsLeft)}</div>
        <div className="row">
          <button className="btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button className="btn ghost" onClick={reset}>
            Zurücksetzen
          </button>
        </div>
      </div>

      <GoogleCalendarWidget />

      <div className="section-title">To-Do</div>
      <div className="row" style={{ marginBottom: 'var(--s3)' }}>
        <input
          className="field"
          placeholder="Neue Aufgabe…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
        />
        <button className="btn" style={{ flex: 'none' }} onClick={addTodo}>
          +
        </button>
      </div>
      <div className="list">
        {todos?.map((t) => (
          <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
            <div className="checkbox-row">
              <input type="checkbox" checked={t.erledigt} onChange={() => toggleTodo(t.id, t.erledigt)} />
              <span className={t.erledigt ? 'strikethrough' : ''}>{t.text}</span>
            </div>
            <button className="icon-btn" onClick={() => deleteTodo(t.id)} aria-label="Löschen">
              ✕
            </button>
          </div>
        ))}
        {todos?.length === 0 && <div className="empty">Keine offenen Aufgaben.</div>}
      </div>
    </div>
  )
}
