// Lizenzfreie Fokusmusik: statt einer externen Audiodatei (Lizenzfragen,
// zusätzlicher Download) wird ein ruhiger Ambient-Klangteppich generativ per
// Web Audio API erzeugt — mehrere leise, langsam schwebende Sinustöne
// (Shepard-artiges Drone-Pad) ohne jede Lizenzproblematik.
let audioCtx: AudioContext | null = null
let masterGain: GainNode | null = null
let voices: { osc: OscillatorNode; lfo: OscillatorNode; lfoGain: GainNode }[] = []

const GRUNDTOENE = [98, 123.47, 146.83, 196] // G2, B2, D3, G3 – ruhiger Dur-Klang

export function fokusmusikLaeuft(): boolean {
  return voices.length > 0
}

export function startFokusmusik() {
  if (voices.length > 0) return
  if (!audioCtx) audioCtx = new AudioContext()
  const ctx = audioCtx
  if (ctx.state === 'suspended') void ctx.resume()

  masterGain = ctx.createGain()
  masterGain.gain.setValueAtTime(0, ctx.currentTime)
  masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2)
  masterGain.connect(ctx.destination)

  voices = GRUNDTOENE.map((freq, i) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    // Sanftes Auf-und-Ab in der Lautstärke jeder Stimme, versetzt zueinander,
    // damit der Klang lebendig statt statisch wirkt.
    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 0.6
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.05 + i * 0.02
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.4
    lfo.connect(lfoGain)
    lfoGain.connect(voiceGain.gain)

    osc.connect(voiceGain)
    voiceGain.connect(masterGain!)
    osc.start()
    lfo.start()
    return { osc, lfo, lfoGain }
  })
}

export function stopFokusmusik() {
  if (!audioCtx || !masterGain) return
  const ctx = audioCtx
  const gain = masterGain
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1)
  const alteVoices = voices
  voices = []
  masterGain = null
  window.setTimeout(() => {
    alteVoices.forEach(({ osc, lfo }) => {
      osc.stop()
      lfo.stop()
    })
    gain.disconnect()
  }, 1100)
}
