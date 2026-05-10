import { BrandKit, Preset, SafeZone, Slide } from '../types';
import { ensureBrandFonts } from './fontLoader';

export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let current = '';
    for (const w of words) {
      const test = current ? current + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        out.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export type RenderOptions = {
  slideIndex: number;
  slideTotal: number;
  includeIndicator?: boolean;
  includeLogo?: boolean;
  photoUrl?: string | null;
};

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveSafeZone(preset: Preset, slide: Slide): SafeZone {
  const override = slide.overrides?.safe_zone;
  if (override) return override;
  const pos = slide.overrides?.text_position;
  if (pos) {
    const base = preset.safe_zones;
    if (pos === 'top') return { ...base, position: 'top', y: 6 };
    if (pos === 'middle') return { ...base, position: 'middle', y: 33 };
    return { ...base, position: 'bottom', y: 60 };
  }
  return preset.safe_zones;
}

export async function renderSlide(
  canvas: HTMLCanvasElement,
  slide: Slide,
  preset: Preset,
  brandKit: BrandKit | null,
  opts: RenderOptions
): Promise<void> {
  const { width, height } = preset;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (brandKit?.fonts) {
    try {
      await ensureBrandFonts(brandKit.fonts);
      await document.fonts.ready;
    } catch {
      // ignore font errors; fallback rendering continues
    }
  }

  ctx.fillStyle = brandKit?.colors.primary || '#0F172A';
  ctx.fillRect(0, 0, width, height);

  const photo = opts.photoUrl ?? slide.photo_url;
  let imgEl: HTMLImageElement | null = null;
  if (photo) {
    try {
      imgEl = await loadImage(photo);
      const userScale = slide.overrides?.photo_scale ?? 1;
      const baseScale = Math.max(width / imgEl.width, height / imgEl.height);
      const scale = baseScale * userScale;
      const sw = imgEl.width * scale;
      const sh = imgEl.height * scale;
      const ox = (slide.overrides?.photo_offset_x ?? 0) * width;
      const oy = (slide.overrides?.photo_offset_y ?? 0) * height;
      const sx = (width - sw) / 2 + ox;
      const sy = (height - sh) / 2 + oy;
      ctx.drawImage(imgEl, sx, sy, sw, sh);
    } catch {
      // ignore
    }
  }

  const sz = resolveSafeZone(preset, slide);
  const tox = (slide.overrides?.text_offset_x ?? 0) * width;
  const toy = (slide.overrides?.text_offset_y ?? 0) * height;
  const zx = (sz.x / 100) * width + tox;
  const zy = (sz.y / 100) * height + toy;
  const zw = (sz.w / 100) * width;
  const zh = (sz.h / 100) * height;

  const baseOverlay = preset.background_overlay;
  const overlay = { ...baseOverlay, ...(slide.overrides?.background_overlay || {}) };

  if (overlay.type === 'solid') {
    ctx.fillStyle = hexWithAlpha(overlay.color, overlay.opacity);
    ctx.fillRect(zx, zy, zw, zh);
  } else if (overlay.type === 'gradient') {
    let grad: CanvasGradient;
    if (sz.position === 'top') {
      grad = ctx.createLinearGradient(0, zy, 0, zy + zh);
      grad.addColorStop(0, hexWithAlpha(overlay.color, overlay.opacity));
      grad.addColorStop(0.5, hexWithAlpha(overlay.color, overlay.opacity * 0.6));
      grad.addColorStop(1, hexWithAlpha(overlay.color, 0));
    } else if (sz.position === 'middle') {
      grad = ctx.createLinearGradient(0, zy, 0, zy + zh);
      grad.addColorStop(0, hexWithAlpha(overlay.color, 0));
      grad.addColorStop(0.5, hexWithAlpha(overlay.color, overlay.opacity * 0.7));
      grad.addColorStop(1, hexWithAlpha(overlay.color, 0));
    } else {
      grad = ctx.createLinearGradient(0, zy, 0, zy + zh);
      grad.addColorStop(0, hexWithAlpha(overlay.color, 0));
      grad.addColorStop(0.5, hexWithAlpha(overlay.color, overlay.opacity * 0.6));
      grad.addColorStop(1, hexWithAlpha(overlay.color, overlay.opacity));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(zx, zy, zw, zh);
  } else if (overlay.type === 'blur' && imgEl) {
    const off = document.createElement('canvas');
    off.width = width;
    off.height = height;
    const octx = off.getContext('2d')!;
    const scale = Math.max(width / imgEl.width, height / imgEl.height);
    const sw = imgEl.width * scale;
    const sh = imgEl.height * scale;
    octx.drawImage(imgEl, (width - sw) / 2, (height - sh) / 2, sw, sh);
    ctx.save();
    ctx.filter = 'blur(40px)';
    ctx.beginPath();
    ctx.rect(zx, zy, zw, zh);
    ctx.clip();
    ctx.drawImage(off, 0, 0);
    ctx.restore();
    ctx.fillStyle = hexWithAlpha(overlay.color, overlay.opacity * 0.5);
    ctx.fillRect(zx, zy, zw, zh);
  }

  const m = preset.margins;
  const innerX = zx + m.left;
  const innerW = zw - m.left - m.right;
  let y = zy + m.top;

  const fontHead = brandKit?.fonts.headline.name || 'Inter';
  const fontBody = brandKit?.fonts.body.name || 'Inter';

  try {
    await Promise.all([
      document.fonts.load(
        `${preset.text_styles.headline.weight} ${preset.text_styles.headline.size}px "${fontHead}"`
      ),
      document.fonts.load(
        `${preset.text_styles.body.weight} ${preset.text_styles.body.size}px "${fontBody}"`
      ),
      document.fonts.load(
        `${preset.text_styles.caption.weight} ${preset.text_styles.caption.size}px "${fontBody}"`
      ),
    ]);
  } catch {
    // ignore
  }

  const drawBlock = (text: string, style: typeof preset.text_styles.headline, font: string) => {
    if (!text) return;
    ctx.fillStyle = style.color;
    ctx.font = `${style.weight} ${style.size}px "${font}", sans-serif`;
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, text, innerW);
    const lineH = style.size * 1.2;
    for (const line of lines) {
      let x = innerX;
      if (style.align === 'center') {
        const w = ctx.measureText(line).width;
        x = innerX + (innerW - w) / 2;
      } else if (style.align === 'right') {
        const w = ctx.measureText(line).width;
        x = innerX + innerW - w;
      }
      ctx.fillText(line, x, y);
      y += lineH;
    }
    y += m.gap;
  };

  drawBlock(slide.headline, preset.text_styles.headline, fontHead);
  drawBlock(slide.body, preset.text_styles.body, fontBody);
  drawBlock(slide.caption, preset.text_styles.caption, fontBody);

  // Indicator
  if (opts.includeIndicator !== false && preset.indicator_settings.visible) {
    const pad = 40;
    const pos = preset.indicator_settings.position;
    if (preset.indicator_settings.style === 'dots') {
      const total = opts.slideTotal;
      const dot = 14;
      const gap = 8;
      const totalW = total * dot + (total - 1) * gap;
      const dx = pos.includes('right') ? width - pad - totalW : pad;
      const dy = pos.includes('top') ? pad : height - pad - dot;
      for (let i = 0; i < total; i++) {
        ctx.globalAlpha = i === opts.slideIndex ? 1 : 0.4;
        ctx.fillStyle = brandKit?.colors.textOnDark || '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dx + i * (dot + gap) + dot / 2, dy + dot / 2, dot / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const label = `${opts.slideIndex + 1}/${opts.slideTotal}`;
      ctx.font = `600 28px "${fontBody}", sans-serif`;
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(label).width;
      const bx = pos.includes('right') ? width - pad - tw : pad;
      const by = pos.includes('top') ? pad : height - pad - 28;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx - 12, by - 6, tw + 24, 40);
      ctx.fillStyle = brandKit?.colors.textOnDark || '#FFFFFF';
      ctx.fillText(label, bx, by);
    }
  }

  if (opts.includeLogo !== false && preset.logo_settings.visible && brandKit?.logo_url) {
    try {
      const logo = await loadImage(brandKit.logo_url);
      const s = preset.logo_settings.size;
      const pad = 40;
      const pos = preset.logo_settings.position;
      const lx = pos.includes('right') ? width - pad - s : pad;
      const ly = pos.includes('top') ? pad : height - pad - s;
      ctx.globalAlpha = preset.logo_settings.opacity;
      const ratio = logo.height / logo.width;
      ctx.drawImage(logo, lx, ly, s, s * ratio);
      ctx.globalAlpha = 1;
    } catch {
      // ignore
    }
  }
}

export async function slideToBlob(
  slide: Slide,
  preset: Preset,
  brandKit: BrandKit | null,
  opts: RenderOptions,
  format: 'png' | 'jpeg' = 'png',
  quality = 0.92
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  await renderSlide(canvas, slide, preset, brandKit, opts);
  return new Promise((resolve) => {
    canvas.toBlob(
      (b) => resolve(b!),
      format === 'png' ? 'image/png' : 'image/jpeg',
      quality
    );
  });
}

export async function renderThumbnail(
  slide: Slide,
  preset: Preset,
  brandKit: BrandKit | null,
  opts: RenderOptions,
  targetWidth = 240
): Promise<string> {
  const full = document.createElement('canvas');
  await renderSlide(full, slide, preset, brandKit, opts);
  const ratio = preset.height / preset.width;
  const small = document.createElement('canvas');
  small.width = targetWidth;
  small.height = Math.round(targetWidth * ratio);
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(full, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', 0.82);
}
