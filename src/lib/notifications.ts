// Shared notification helpers used by every "something happened" moment in
// the app — new job for a driver, order status flipping for a buyer, new
// order landing for a seller. Two channels: Web Audio beeps (playable
// straight from an event handler with no asset load) and browser push
// notifications (fire-and-forget once permission is granted).
//
// Sound is intentionally the same shape everywhere (short exponential
// decay, sine wave) so a user learns the audio signature quickly. Only the
// frequency + tone-count varies per event so a driver hearing a double
// beep instantly knows "job" and a buyer hearing a single higher tone
// knows "driver arrived".

type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

// Play a single tone. `duration` is in seconds; `volume` is 0-1.
// exponentialRampToValueAtTime to a hair above zero gives a natural
// exponential decay — much less jarring than an abrupt stop.
export function playBeep(frequency = 880, duration = 0.3, volume = 0.6): void {
  if (typeof window === 'undefined') return
  try {
    const w = window as AudioContextWindow
    const AudioCtx = window.AudioContext || w.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
    // Free the AudioContext once the tone finishes so we don't accumulate
    // dozens of them across a long session.
    osc.onended = () => { ctx.close().catch(() => {}) }
  } catch {
    // Autoplay policy, missing WebAudio, closed context — audio is a
    // nice-to-have, never fatal.
    console.warn('Audio not available')
  }
}

// 880 → 1100 double beep. Used for "attention" events — new order for a
// seller, new job for a driver. The 200ms gap between tones gives the ear
// enough separation to hear it as a distinct two-tone signal, not one
// warble.
export function playDoubleBeep(): void {
  playBeep(880, 0.15, 0.6)
  setTimeout(() => playBeep(1100, 0.15, 0.6), 200)
}

// Ask the browser for Notification permission if we haven't already. Safe
// to call on every mount — the browser only prompts on 'default'.
export async function requestNotificationPermission(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission() } catch { /* iOS quirks */ }
  }
}

// Fire a browser push notification if permission is granted. Silent no-op
// otherwise so callers don't have to guard.
export function showPushNotification(title: string, body: string, icon = '/favicon.png'): void {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon })
  } catch {
    // Safari / iOS sometimes throws on Notification construction outside a
    // user gesture. Non-fatal.
  }
}
