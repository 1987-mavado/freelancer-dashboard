import { useState } from 'react'
import { startFokusmusik, stopFokusmusik } from '../utils/fokusmusik'
import { SpeakerIcon } from './icons'

// Globaler Header-Toggle (unabhängig von allen Widgets): Fokusmusik ist
// standardmäßig aus und startet nur nach bewusstem Klick. Lebt in AppShell,
// das über die gesamte Sitzung gemountet bleibt, damit der Ein/Aus-Zustand
// beim Navigieren nicht verloren geht.
export default function FokusmusikHeaderToggle() {
  const [an, setAn] = useState(false)

  function toggle() {
    if (an) {
      stopFokusmusik()
      setAn(false)
    } else {
      startFokusmusik()
      setAn(true)
    }
  }

  return (
    <button
      type="button"
      className="header-icon-btn"
      onClick={toggle}
      aria-label={an ? 'Fokusmusik ausschalten' : 'Fokusmusik einschalten'}
      title={an ? 'Fokusmusik ausschalten' : 'Fokusmusik einschalten'}
    >
      <SpeakerIcon an={an} />
    </button>
  )
}
