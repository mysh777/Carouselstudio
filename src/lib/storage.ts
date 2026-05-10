import { supabase } from './supabase';

const BUCKET = 'carousel-photos';

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export async function getSignedPhotoUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expiresAt > now) return cached.url;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  cache.set(path, { url: data.signedUrl, expiresAt: now + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadPhoto(
  userId: string,
  projectId: string,
  slideId: string,
  blob: Blob
): Promise<string | null> {
  const path = `${userId}/${projectId}/${slideId}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) return null;
  cache.delete(path);
  return path;
}

export async function removePhotos(paths: string[]): Promise<void> {
  const valid = paths.filter(Boolean);
  if (valid.length === 0) return;
  await supabase.storage.from(BUCKET).remove(valid);
  for (const p of valid) cache.delete(p);
}

export async function uploadFont(
  userId: string,
  fontName: string,
  file: File
): Promise<{ path: string } | null> {
  const safe = fontName.replace(/[^\w-]/g, '_');
  const ext = (file.name.split('.').pop() || 'woff2').toLowerCase();
  const path = `${userId}/${safe}.${ext}`;
  const { error } = await supabase.storage.from('fonts').upload(path, file, {
    upsert: true,
    contentType: file.type || 'font/woff2',
  });
  if (error) return null;
  fontUrlCache.delete(path);
  return { path };
}

const fontUrlCache = new Map<string, CacheEntry>();

export async function getSignedFontUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const now = Date.now();
  const cached = fontUrlCache.get(path);
  if (cached && cached.expiresAt > now) return cached.url;
  const { data, error } = await supabase.storage
    .from('fonts')
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  fontUrlCache.set(path, { url: data.signedUrl, expiresAt: now + 50 * 60 * 1000 });
  return data.signedUrl;
}
