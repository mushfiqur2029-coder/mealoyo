'use client'
import { useEffect, useState } from 'react'

// Lightweight dependency-free bar chart (recharts isn't in the bundle). Pure
// inline SVG so it renders identically on server and client and adds no weight.
// Bars grow in on mount. Brand-coloured, Georgia value labels.
export interface Bar {
  label: string // short axis label, e.g. "Mon"
  value: number // pounds
}

export default function WeeklyBarChart({ bars, dark = true }: { bars: Bar[]; dark?: boolean }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 40)
    return () => clearTimeout(t)
  }, [])

  const max = Math.max(1, ...bars.map((b) => b.value))
  const axis = dark ? 'rgba(255,255,255,0.45)' : 'rgba(26,26,26,0.5)'
  const track = dark ? 'rgba(255,255,255,0.05)' : 'rgba(200,0,106,0.05)'
  const valueColor = dark ? '#fff' : '#1A1A1A'

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 200, width: '100%' }}>
      {bars.map((b, i) => {
        const pct = grown ? (b.value / max) * 100 : 0
        const isTop = b.value === max && b.value > 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0, height: '100%' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 11.5, fontWeight: 700, color: b.value > 0 ? valueColor : axis, whiteSpace: 'nowrap' }}>
              £{b.value.toFixed(0)}
            </div>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', background: track, borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: '100%',
                  height: `${pct}%`,
                  minHeight: b.value > 0 ? 4 : 0,
                  background: isTop ? 'linear-gradient(180deg,#C8006A,#7A0042)' : 'linear-gradient(180deg,rgba(200,0,106,0.75),rgba(200,0,106,0.4))',
                  borderRadius: 8,
                  transition: 'height 0.6s cubic-bezier(0.34,1.1,0.64,1)',
                }}
              />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: axis, whiteSpace: 'nowrap' }}>{b.label}</div>
          </div>
        )
      })}
    </div>
  )
}
