import { useState } from 'react'
import { startFokusmusik, stopFokusmusik } from '../../utils/fokusmusik'

// Lautsprecher-Icon: Fokusmusik ist standardmäßig aus und startet nur nach
// bewusstem Klick (kein Autoplay).
export default function FokusmusikToggle() {
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
      className="icon-btn"
      onClick={toggle}
      aria-label={an ? 'Fokusmusik ausschalten' : 'Fokusmusik einschalten'}
      title={an ? 'Fokusmusik ausschalten' : 'Fokusmusik einschalten'}
      style={{ fontSize: 22 }}
    >
      {an ? '🔊' : '🔈'}
    </button>
  )
}
