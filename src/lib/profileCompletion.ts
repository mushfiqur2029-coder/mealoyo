// Profile completion scoring — shared by the profile pages, the dashboards
// and (potentially) the admin views. Deterministic, pure function. Keeping
// the weights here (rather than scattered across the UI) means changing one
// number updates every consumer at once.

import type { Profile, User } from '@/lib/types'

export type Role = 'buyer' | 'seller' | 'driver'

// One row in the checklist. `points` is used for the % calculation; `required`
// is a soft cue for the UI (red asterisk vs grey dot) — the calculation
// doesn't distinguish, it just weights.
export interface ChecklistItem {
  field: string
  label: string
  points: number
  required: boolean
  // Anchor id on the profile page — used by the "Add now" scroll-into-view
  // link on missing rows.
  anchor: string
}

export interface CompletionResult {
  percentage: number
  completed: ChecklistItem[]
  missing: ChecklistItem[]
  // Handy pre-computed booleans for the banner variants on seller/driver.
  isComplete: boolean
}

// Weights per role. Numbers must total 100 or the percentages don't add up.
const BUYER_ITEMS: ChecklistItem[] = [
  { field: 'avatar_url',         label: 'Profile photo',       points: 10, required: false, anchor: 'avatar' },
  { field: 'full_name',          label: 'Full name',           points: 15, required: true,  anchor: 'name' },
  { field: 'phone',              label: 'Phone number',        points: 15, required: true,  anchor: 'phone' },
  { field: 'address_line1',      label: 'Street address',      points: 15, required: true,  anchor: 'address' },
  { field: 'postcode',           label: 'Postcode',            points: 15, required: true,  anchor: 'address' },
  { field: 'city',               label: 'City / Town',         points: 10, required: true,  anchor: 'address' },
  { field: 'email_verified',     label: 'Email verified',      points: 10, required: true,  anchor: 'email' },
  { field: 'password_set',       label: 'Password set',        points: 10, required: false, anchor: 'password' },
]

const SELLER_ITEMS: ChecklistItem[] = [
  { field: 'avatar_url',           label: 'Profile photo',        points: 10, required: false, anchor: 'avatar' },
  { field: 'full_name',            label: 'Full name',            points: 10, required: true,  anchor: 'name' },
  { field: 'phone',                label: 'Phone number',         points: 10, required: true,  anchor: 'phone' },
  { field: 'address_line1',        label: 'Street address',       points: 10, required: true,  anchor: 'address' },
  { field: 'postcode',             label: 'Postcode',             points: 10, required: true,  anchor: 'address' },
  { field: 'city',                 label: 'City / Town',          points: 5,  required: true,  anchor: 'address' },
  { field: 'bank_account_name',    label: 'Bank account name',    points: 10, required: true,  anchor: 'bank' },
  { field: 'bank_sort_code',       label: 'Sort code',            points: 10, required: true,  anchor: 'bank' },
  { field: 'bank_account_number',  label: 'Account number',       points: 10, required: true,  anchor: 'bank' },
  { field: 'has_listing',          label: 'At least 1 live dish', points: 15, required: true,  anchor: 'listings' },
]

const DRIVER_ITEMS: ChecklistItem[] = [
  { field: 'avatar_url',           label: 'Profile photo',        points: 10, required: false, anchor: 'avatar' },
  { field: 'full_name',            label: 'Full name',            points: 10, required: true,  anchor: 'name' },
  { field: 'phone',                label: 'Phone number',         points: 10, required: true,  anchor: 'phone' },
  { field: 'address_line1',        label: 'Street address',       points: 10, required: true,  anchor: 'address' },
  { field: 'postcode',             label: 'Postcode',             points: 10, required: true,  anchor: 'address' },
  { field: 'city',                 label: 'City / Town',          points: 5,  required: true,  anchor: 'address' },
  { field: 'bank_account_name',    label: 'Bank account name',    points: 10, required: true,  anchor: 'bank' },
  { field: 'bank_sort_code',       label: 'Sort code',            points: 10, required: true,  anchor: 'bank' },
  { field: 'bank_account_number',  label: 'Account number',       points: 10, required: true,  anchor: 'bank' },
  { field: 'vehicle_type',         label: 'Vehicle type',         points: 15, required: true,  anchor: 'vehicle' },
]

function itemsFor(role: Role): ChecklistItem[] {
  if (role === 'seller') return SELLER_ITEMS
  if (role === 'driver') return DRIVER_ITEMS
  return BUYER_ITEMS
}

// Signal for whether a field on the profile is "filled". Empty strings and
// nulls both count as unfilled. Bank fields also have to look plausibly like
// they were saved (not a leftover blank string), so a trim() check is the
// right shape here.
function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'boolean') return v
  return true
}

// Extra context the pure `profile` shape doesn't cover: whether a seller has
// at least one live listing, whether the auth account has a confirmed email
// and a password credential.
export interface CompletionContext {
  hasListing?: boolean
  emailVerified?: boolean
  passwordSet?: boolean
}

// Given the caller's profile row + role + context, compute the percentage and
// the two lists the checklist UI renders.
export function calculateProfileCompletion(
  profile: Partial<Profile> | null | undefined,
  role: Role,
  ctx: CompletionContext = {},
): CompletionResult {
  const items = itemsFor(role)
  const completed: ChecklistItem[] = []
  const missing: ChecklistItem[] = []

  for (const item of items) {
    let filled = false
    switch (item.field) {
      case 'has_listing':    filled = !!ctx.hasListing; break
      case 'email_verified': filled = !!ctx.emailVerified; break
      case 'password_set':   filled = !!ctx.passwordSet; break
      default:
        // Everything else is a direct field on the profile row.
        filled = isFilled((profile as Record<string, unknown> | null | undefined)?.[item.field])
        break
    }
    if (filled) completed.push(item)
    else missing.push(item)
  }

  const earned = completed.reduce((sum, item) => sum + item.points, 0)
  const percentage = Math.min(100, Math.max(0, Math.round(earned)))
  return { percentage, completed, missing, isComplete: percentage >= 100 }
}

// Deriving email-verified + password-set from the Supabase User object is
// awkward at the call sites, so wrap it here. `identities` contains one row
// per provider; a row with provider='email' implies a password was set at
// some point. `email_confirmed_at` is Supabase's own signal that the address
// was verified.
export function ctxFromAuthUser(user: User | null | undefined): Pick<CompletionContext, 'emailVerified' | 'passwordSet'> {
  if (!user) return { emailVerified: false, passwordSet: false }
  const identities = (user as { identities?: Array<{ provider?: string }> }).identities ?? []
  const passwordSet = identities.some((i) => i.provider === 'email')
  const emailVerified = !!(user as { email_confirmed_at?: string | null }).email_confirmed_at
  return { emailVerified, passwordSet }
}
