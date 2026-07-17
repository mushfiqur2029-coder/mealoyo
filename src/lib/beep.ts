// Short 880Hz notification beep via the Web Audio API. No asset needed and
// no external dependency — the AudioContext is created on demand.
// Wrapped so autoplay-policy failures, missing WebAudio, or an already-
// closed context never throw.
export function playNotificationBeep(): void {
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const AudioCtx = W.AudioContext || W.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.55)
    osc.onended = () => ctx.close().catch(() => {})
  } catch { /* ignore — audio is a nice-to-have */ }
}
