import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { zeiteintraegeRepo, todosRepo } from '../db/repo'
import { starteTimer, stoppeTimer, kumulierteMinutenFuerTodo } from '../utils/zeiterfassung'
import { playRing } from '../utils/sound'
import type { Zeiteintrag, ToDo } from '../db/types'

const PAUSE_SEKUNDEN = 5 * 60
// Feste Pomodoro-Struktur: ein Arbeitsblock dauert immer maximal 25 Minuten,
// unabhängig von der geschätzten Gesamtdauer der Aufgabe. Ist von der
// Schätzung noch weniger als 25 Minuten übrig, ist der Block entsprechend
// kürzer (z.B. die letzten 5 Minuten einer 30-Minuten-Aufgabe).
const ARBEIT_BLOCK_SEKUNDEN = 25 * 60

// Wie viele Minuten von der Schätzung einer Aufgabe noch nicht durch bereits
// abgeschlossene Zeiteinträge (frühere Blöcke) "verbraucht" sind.
async function restMinutenFuerTodo(todo: ToDo, ausschlussEintragId?: number): Promise<number> {
  const alle = await zeiteintraegeRepo.list()
  const relevante = ausschlussEintragId ? alle.filter((z) => z.id !== ausschlussEintragId) : alle
  const erledigt = kumulierteMinutenFuerTodo(relevante, todo.id!)
  return Math.max(1, todo.geschaetzteMinuten - erledigt)
}

export type TimerPhase = 'idle' | 'arbeit' | 'pause-bereit' | 'pause-laeuft'

interface TimerState {
  phase: TimerPhase
  laufenderEintrag: Zeiteintrag | null
  laufendesTodo: ToDo | null
  restSekundenArbeit: number
  restSekundenPause: number
  start: (todo: ToDo) => Promise<void>
  stopManuell: () => Promise<void>
  startPause: () => void
  pauseUeberspringen: () => void
}

const TimerContext = createContext<TimerState | null>(null)

// Globaler Timer-Provider: hält den laufenden Zeiteintrag/die aktive Aufgabe
// im App-weiten Context (statt Seiten-lokalem State), damit der Timer beim
// Navigieren zwischen Seiten weiterläuft — inkl. Sound-Alarm bei Ablauf und
// dem anschließenden 5-Min-Pausentimer, unabhängig davon, welche Seite gerade
// angezeigt wird. Wird einmal in App.tsx um den gesamten Router gelegt.
export function TimerProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [laufenderEintrag, setLaufenderEintrag] = useState<Zeiteintrag | null>(null)
  const [laufendesTodo, setLaufendesTodo] = useState<ToDo | null>(null)
  const [restSekundenArbeit, setRestSekundenArbeit] = useState(0)
  // Zielsekunden des GERADE laufenden Arbeitsblocks (max. 25 Min, siehe
  // ARBEIT_BLOCK_SEKUNDEN) — unabhängig von der Gesamt-Schätzung der Aufgabe.
  const [blockSekunden, setBlockSekunden] = useState(0)
  const [pauseStart, setPauseStart] = useState<number | null>(null)
  const [restSekundenPause, setRestSekundenPause] = useState(PAUSE_SEKUNDEN)

  const geklingeltRef = useRef(false)

  // Beim Laden: einen ggf. noch laufenden Zeiteintrag (z.B. nach Neuladen der
  // Seite) wiederherstellen, damit der Timer nicht "verschwindet".
  useEffect(() => {
    ;(async () => {
      const alle = await zeiteintraegeRepo.list()
      const laufend = alle.find((z) => z.laeuft)
      if (!laufend) return
      setLaufenderEintrag(laufend)
      if (laufend.todoId) {
        const todo = await todosRepo.get(laufend.todoId)
        if (todo) {
          setLaufendesTodo(todo)
          // Block-Ziel neu ermitteln (derselbe Rest-Minuten-Block wie beim
          // ursprünglichen Start, laufender Eintrag selbst zählt nicht als
          // "bereits erledigt").
          const rest = await restMinutenFuerTodo(todo, laufend.id)
          setBlockSekunden(Math.min(ARBEIT_BLOCK_SEKUNDEN, rest * 60))
        }
      }
      setPhase('arbeit')
      geklingeltRef.current = true // kein erneutes Klingeln nur wegen Neuladen der Seite
    })()
  }, [])

  // Tickt jede Sekunde, solange Arbeits- oder Pausenphase aktiv ist.
  useEffect(() => {
    if (phase !== 'arbeit' && phase !== 'pause-laeuft') return
    const iv = window.setInterval(() => {
      if (phase === 'arbeit' && laufenderEintrag?.startZeit && laufendesTodo) {
        const start = new Date(laufenderEintrag.startZeit).getTime()
        const verstrichen = Math.floor((Date.now() - start) / 1000)
        const rest = blockSekunden - verstrichen
        setRestSekundenArbeit(rest)
        if (rest <= 0 && !geklingeltRef.current) {
          geklingeltRef.current = true
          playRing()
          stoppeTimer(laufenderEintrag).then(() => {
            setLaufenderEintrag(null)
            setPhase('pause-bereit')
          })
        }
      } else if (phase === 'pause-laeuft' && pauseStart) {
        const verstrichen = Math.floor((Date.now() - pauseStart) / 1000)
        const rest = PAUSE_SEKUNDEN - verstrichen
        setRestSekundenPause(rest)
        if (rest <= 0 && !geklingeltRef.current) {
          geklingeltRef.current = true
          playRing()
          setPhase('idle')
          setLaufendesTodo(null)
          setPauseStart(null)
        }
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, laufenderEintrag, laufendesTodo, pauseStart, blockSekunden])

  async function start(todo: ToDo) {
    if (phase !== 'idle' || !todo.id || !todo.projektId || todo.geschaetzteMinuten <= 0) return
    geklingeltRef.current = false
    const restMinuten = await restMinutenFuerTodo(todo)
    const ziel = Math.min(ARBEIT_BLOCK_SEKUNDEN, restMinuten * 60)
    const id = await starteTimer(todo.projektId, todo.rolle || 'Allgemein', todo.id)
    const eintrag = await zeiteintraegeRepo.get(id)
    setLaufenderEintrag(eintrag ?? null)
    setLaufendesTodo(todo)
    setBlockSekunden(ziel)
    setRestSekundenArbeit(ziel)
    setPhase('arbeit')
  }

  async function stopManuell() {
    if (laufenderEintrag) await stoppeTimer(laufenderEintrag)
    setLaufenderEintrag(null)
    setLaufendesTodo(null)
    setPhase('idle')
    setPauseStart(null)
  }

  function startPause() {
    if (phase !== 'pause-bereit') return
    geklingeltRef.current = false
    setPauseStart(Date.now())
    setRestSekundenPause(PAUSE_SEKUNDEN)
    setPhase('pause-laeuft')
  }

  function pauseUeberspringen() {
    setPhase('idle')
    setLaufendesTodo(null)
    setPauseStart(null)
  }

  return (
    <TimerContext.Provider
      value={{
        phase,
        laufenderEintrag,
        laufendesTodo,
        restSekundenArbeit,
        restSekundenPause,
        start,
        stopManuell,
        startPause,
        pauseUeberspringen,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimerContext(): TimerState {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimerContext muss innerhalb von TimerProvider verwendet werden')
  return ctx
}
