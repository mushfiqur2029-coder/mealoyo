import SuspendedNotice from '@/components/SuspendedNotice'

// Standalone page the proxy redirects suspended users to when they try to reach
// a protected route. No nav — SuspendedNotice renders the whole screen.
export default function SuspendedPage() {
  return <SuspendedNotice />
}
