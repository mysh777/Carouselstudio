import { FontSpec } from '../types';
import { getSignedFontUrl } from './storage';

const loadedKeys = new Set<string>();

function keyFor(spec: FontSpec): string {
  return `${spec.source}:${spec.name}:${spec.weights.join(',')}:${spec.url || ''}`;
}

export async function loadGoogleFont(name: string, weights: number[]): Promise<void> {
  const family = name.trim().replace(/\s+/g, '+');
  const key = `google:${name}:${weights.join(',')}`;
  if (loadedKeys.has(key)) return;
  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weights.join(';')}&display=block`;
  const existing = document.querySelector(`link[data-font-key="${key}"]`);
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.setAttribute('data-font-key', key);
    document.head.appendChild(link);
  }
  try {
    await Promise.all(
      weights.map((w) => document.fonts.load(`${w} 32px "${name}"`))
    );
  } catch {
    // ignore; document.fonts.ready catches completion
  }
  loadedKeys.add(key);
}

export async function loadCustomFont(
  name: string,
  urlOrPath: string,
  weight: number
): Promise<void> {
  let resolved = urlOrPath;
  if (!/^https?:\/\//i.test(urlOrPath) && !urlOrPath.startsWith('data:')) {
    const signed = await getSignedFontUrl(urlOrPath);
    if (!signed) throw new Error(`Failed to resolve font path: ${urlOrPath}`);
    resolved = signed;
  }
  const key = `custom:${name}:${weight}:${urlOrPath}`;
  if (loadedKeys.has(key)) return;
  const ff = new FontFace(name, `url(${resolved})`, { weight: String(weight) });
  const loaded = await ff.load();
  document.fonts.add(loaded);
  loadedKeys.add(key);
}

export async function ensureFontSpec(spec: FontSpec): Promise<void> {
  if (!spec?.name) return;
  const key = keyFor(spec);
  if (loadedKeys.has(key)) return;
  if (spec.source === 'google') {
    await loadGoogleFont(spec.name, spec.weights.length ? spec.weights : [400, 700]);
  } else if (spec.source === 'custom' && spec.url) {
    for (const w of spec.weights.length ? spec.weights : [400]) {
      await loadCustomFont(spec.name, spec.url, w);
    }
  }
  loadedKeys.add(key);
}

export async function ensureBrandFonts(fonts: {
  headline: FontSpec;
  body: FontSpec;
  accent: FontSpec;
}): Promise<void> {
  await Promise.all([
    ensureFontSpec(fonts.headline),
    ensureFontSpec(fonts.body),
    ensureFontSpec(fonts.accent),
  ]);
  await document.fonts.ready;
}
