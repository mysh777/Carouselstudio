import { useEffect, useRef, useState } from 'react';
import { BrandKit, Preset, Slide } from '../types';
import { renderThumbnail } from '../lib/renderSlide';

type Thumbs = Record<string, string>;

export function useSlideThumbnails(
  slides: Slide[],
  preset: Preset | null,
  brand: BrandKit | null,
  photoUrls: Record<string, string>
): Thumbs {
  const [thumbs, setThumbs] = useState<Thumbs>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevKeys = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!preset) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const nextKeys: Record<string, string> = {};
      const updated: Thumbs = {};
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const url = s.photo_url ? photoUrls[s.photo_url] || null : null;
        const key = JSON.stringify([
          s.id,
          s.headline,
          s.body,
          s.caption,
          s.photo_url,
          url,
          s.overrides,
          preset.id,
          preset.updated_at,
          brand?.id,
          brand?.updated_at,
          i,
          slides.length,
        ]);
        nextKeys[s.id] = key;
        if (prevKeys.current[s.id] === key && thumbs[s.id]) {
          updated[s.id] = thumbs[s.id];
          continue;
        }
        try {
          const dataUrl = await renderThumbnail(
            s,
            preset,
            brand,
            { slideIndex: i, slideTotal: slides.length, photoUrl: url },
            240
          );
          updated[s.id] = dataUrl;
        } catch {
          // skip
        }
      }
      prevKeys.current = nextKeys;
      setThumbs(updated);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, preset, brand, photoUrls]);

  return thumbs;
}
