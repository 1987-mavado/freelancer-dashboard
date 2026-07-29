// Erzeugt Töne per Web Audio API — bewusst ohne externe Audiodateien, damit
// keine Lizenzfragen entstehen und nichts nachgeladen werden muss.
let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function tone(freq: number, startOffset: number, duration: number, gainPeak = 0.25) {
  const audioCtx = getCtx()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const start = audioCtx.currentTime + startOffset
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

// "Klingeln" bei Timer-Ablauf: drei kurze Glockenschläge.
export function playRing() {
  tone(880, 0, 0.5)
  tone(880, 0.35, 0.5)
  tone(880, 0.7, 0.6)
}
