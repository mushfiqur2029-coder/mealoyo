import type { Profile } from '@/lib/types'

// Single source of truth for "where does this signed-in user belong?". Used by
// the OAuth callback, the login page, AuthProvider and complete-profile so they
// can never disagree about the destination.
//
//   no profile / no role  → /auth/complete-profile  (new OAuth user)
//   role = admin          → /admin/dashboard
//   status = pending      → /pending                (seller/driver awaiting review)
//   role = seller         → /seller/dashboard
//   role = driver         → /driver/dashboard
//   otherwise (buyer)     → /buyer/dashboard
export function dashboardPathForProfile(profile: Profile | null | undefined): string {
  if (!profile || !profile.role) return '/auth/complete-profile'
  if (profile.role === 'admin') return '/admin/dashboard'
  if (profile.status === 'pending') return '/pending'
  if (profile.role === 'seller') return '/seller/dashboard'
  if (profile.role === 'driver') return '/driver/dashboard'
  return '/buyer/dashboard'
}
