import { useTimerContext } from './TimerContext'
import { formatVerstrichen } from '../utils/zeiterfassung'

// Sticky Mini-Widget: bleibt sichtbar, egal auf welcher Seite man sich
// gerade befindet, solange ein Arbeits- oder Pausen-Timer läuft.
export default function TimerWidget() {
  const { phase, laufendesTodo, restSekundenArbeit, restSekundenPause, stopManuell, startPause, pauseUeberspringen } =
    useTimerContext()

  if (phase === 'idle') return null

  if (phase === 'arbeit') {
    return (
      <div className="timer-widget">
        <div className="timer-widget-label">▶ {laufendesTodo?.text}</div>
        <div className="timer-widget-time">{formatVerstrichen(Math.max(0, restSekundenArbeit))}</div>
        <button className="btn small ghost" onClick={stopManuell}>
          Stoppen
        </button>
      </div>
    )
  }

  if (phase === 'pause-bereit') {
    return (
      <div className="timer-widget rot">
        <div className="timer-widget-label">🔔 „{laufendesTodo?.text}" beendet</div>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          <button className="btn small" onClick={startPause}>
            5-Min-Pause starten
          </button>
          <button className="btn small ghost" onClick={pauseUeberspringen}>
            Überspringen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="timer-widget">
      <div className="timer-widget-label">☕ Pause</div>
      <div className="timer-widget-time">{formatVerstrichen(Math.max(0, restSekundenPause))}</div>
      <button className="btn small ghost" onClick={pauseUeberspringen}>
        Pause beenden
      </button>
    </div>
  )
}
