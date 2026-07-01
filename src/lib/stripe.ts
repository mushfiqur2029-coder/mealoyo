import Stripe from 'stripe'

// Server-only Stripe client. Reads the secret (restricted live key rk_live_…)
// from the environment. NEVER import this into a 'use client' file — it must
// never reach the browser bundle. We deliberately omit `apiVersion` so the SDK
// pins to the version it ships with, avoiding a hard-coded version drift.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
