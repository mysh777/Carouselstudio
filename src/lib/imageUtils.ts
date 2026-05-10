export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_DIMENSION = 800;
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export async function fileToResizedBlob(
  file: File,
  maxSide = 1600,
  quality = 0.88
): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  try {
    if (bmp.width < MIN_DIMENSION || bmp.height < MIN_DIMENSION) {
      throw new Error(`Image too small (min ${MIN_DIMENSION}px)`);
    }
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
    );
    return { blob, width: w, height: h };
  } finally {
    bmp.close();
  }
}

const EXT_FALLBACK = /\.(jpe?g|png|webp|heic|heif)$/i;

export function validateUpload(file: File): string | null {
  const mimeOk = ACCEPTED_MIME.includes(file.type as (typeof ACCEPTED_MIME)[number]);
  const missingMime = !file.type || file.type === 'application/octet-stream';
  const extOk = EXT_FALLBACK.test(file.name);
  if (!mimeOk && !(missingMime && extOk)) {
    return `Unsupported format: ${file.type || file.name}`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`;
  }
  return null;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s-]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'carousel';
}
