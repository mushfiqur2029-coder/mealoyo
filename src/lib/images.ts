// Client-side image processing for uploads. Everything here runs in the browser
// via the canvas API — there is no server round-trip. Two consumers:
//   • avatars  — resize to a fixed max dimension, encode at a fixed quality
//   • listings — target a byte ceiling, stepping quality (then size) down to hit it

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Returns an error message if the file is unacceptable, or null if it's fine.
export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Please choose a JPEG, PNG or WebP image.'
  }
  if (file.size > maxBytes) {
    return `That image is too large — please keep it under ${Math.round(maxBytes / (1024 * 1024))}MB.`
  }
  return null
}

// Decode a File into an HTMLImageElement via a temporary object URL.
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
    img.src = url
  })
}

// Draw onto a canvas scaled to fit within maxDim×maxDim, preserving aspect
// ratio and never upscaling.
function drawScaled(img: HTMLImageElement, maxDim: number): HTMLCanvasElement {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not supported in this browser.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Image processing failed.'))),
      'image/jpeg',
      quality,
    )
  })
}

// Resize to maxDim and encode as JPEG at a fixed quality. Used for avatars
// (default 400px, quality 0.85).
export async function compressImage(file: File, maxDim = 400, quality = 0.85): Promise<Blob> {
  const img = await loadImage(file)
  return toJpegBlob(drawScaled(img, maxDim), quality)
}

// Resize to maxDim, then step quality (and, if needed, dimensions) down until
// the JPEG fits under maxBytes. Used for BOTH listing photos and avatars —
// both share the same 80KB target so nothing burns storage. Quality starts
// at 0.82 (mid-tier — visually crisp without wasting bytes on invisible
// detail) and floors at 0.5 (still readable text / faces before we start
// pixelating). Returns the smallest acceptable result, or the best achievable
// when even shrinking + minimum quality can't hit the byte cap.
export async function compressToTarget(
  file: File,
  maxBytes = 80 * 1024,
  maxDim = 600,
): Promise<Blob> {
  const img = await loadImage(file)
  let dim = maxDim
  let canvas = drawScaled(img, dim)
  let quality = 0.82
  let blob = await toJpegBlob(canvas, quality)

  // Phase 1: drop quality at full dimensions (cheap, keeps it sharp).
  while (blob.size > maxBytes && quality > 0.5) {
    quality = Math.round((quality - 0.08) * 100) / 100
    blob = await toJpegBlob(canvas, quality)
  }

  // Phase 2: still too big — shrink dimensions and sweep quality again.
  while (blob.size > maxBytes && dim > 200) {
    dim = Math.round(dim * 0.8)
    canvas = drawScaled(img, dim)
    quality = 0.7
    blob = await toJpegBlob(canvas, quality)
    while (blob.size > maxBytes && quality > 0.5) {
      quality = Math.round((quality - 0.08) * 100) / 100
      blob = await toJpegBlob(canvas, quality)
    }
  }

  return blob
}
