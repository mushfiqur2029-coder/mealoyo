import { supabase } from '@/lib/supabase'

type DeletionEntry = {
  deletedBy: string
  entityType: string
  entityId: string
  entityName?: string | null
  metadata?: Record<string, unknown> | null
}

// Best-effort audit trail. Never throws — a logging failure must not block the
// actual delete. No-ops silently (logs to console) until the deletion_log table
// SQL has been run.
export async function logDeletion(e: DeletionEntry): Promise<void> {
  try {
    const { error } = await supabase.from('deletion_log').insert({
      deleted_by: e.deletedBy,
      entity_type: e.entityType,
      entity_id: e.entityId,
      entity_name: e.entityName ?? null,
      metadata: e.metadata ?? null,
    })
    if (error) console.error('[deletion_log] failed to record deletion:', error.message)
  } catch (err) {
    console.error('[deletion_log] failed to record deletion:', err)
  }
}

// Extract the in-bucket path from a Supabase public URL:
//   https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
// Returns null if the URL doesn't match (external URL, or null/empty). Strips
// any ?v=… cache-buster we append to freshly uploaded images.
export function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const rest = url.slice(idx + marker.length).split('?')[0]
  return rest || null
}
