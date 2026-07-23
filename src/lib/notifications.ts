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

// A single shared AudioContext, lazy-initialised. Browsers block AudioContext
// output until the user has actually interacted with the page; the pattern
// below (init once, resume() on user gesture, reuse forever) is the only way
// to make beeps actually play back predictably.
//
// Fresh `new AudioContext()` calls after page load without a preceding gesture
// stay in `suspended` state and produce no sound — that's the "beeps don't
// fire on the driver dashboard when a job lands" bug in one sentence.
let sharedCtx: AudioContext | null = null

function getOrCreateCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (sharedCtx) return sharedCtx
  try {
    const w = window as AudioContextWindow
    const AudioCtx = window.AudioContext || w.webkitAudioContext
    if (!AudioCtx) return null
    sharedCtx = new AudioCtx()
    return sharedCtx
  } catch { return null }
}

// Call from a user-gesture handler (click / tap / keypress) to unlock audio
// for the rest of the session. Resolves to true if the context is running
// after the call, false otherwise. Safe to call repeatedly.
export async function enableAudio(): Promise<boolean> {
  const ctx = getOrCreateCtx()
  if (!ctx) return false
  if (ctx.state === 'suspended') {
    try { await ctx.resume() } catch { /* browser refused — user needs to gesture */ }
  }
  return ctx.state === 'running'
}

// Non-throwing status check for the "sound on / sound off" pill.
export function isAudioReady(): boolean {
  return sharedCtx !== null && sharedCtx.state === 'running'
}

// Play a single tone. `duration` is in seconds; `volume` is 0-1.
// exponentialRampToValueAtTime to a hair above zero gives a natural
// exponential decay — much less jarring than an abrupt stop.
//
// Uses the shared context when available (survives the whole session with
// no accumulated contexts) and falls back to a one-shot context otherwise
// (which will be suspended pre-gesture but at least won't crash).
export function playBeep(frequency = 880, duration = 0.3, volume = 0.6): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = getOrCreateCtx()
    if (!ctx) return
    // Silent no-op if the browser hasn't allowed audio yet — better than
    // crashing or logging a scary warning every 10 seconds of a poll.
    if (ctx.state !== 'running') return
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
    // Don't close the shared context — it's reused for every beep.
  } catch { /* nice-to-have, never fatal */ }
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
