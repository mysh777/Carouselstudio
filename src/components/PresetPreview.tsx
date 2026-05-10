import { useEffect, useRef } from 'react';
import { BrandKit, Preset, Slide } from '../types';
import { renderSlide } from '../lib/renderSlide';

const SAMPLE = '/preset-sample.webp';

export default function PresetPreview({
  preset,
  brand,
}: {
  preset: Preset;
  brand: BrandKit | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const slide: Slide = {
      id: 'preview',
      project_id: '',
      order_index: 0,
      photo_url: '',
      headline: 'Headline goes here',
      body: 'This is where the body copy lives — keep it focused and scannable.',
      caption: '1/5',
      overrides: {},
      created_at: '',
      updated_at: '',
    };
    if (ref.current) {
      renderSlide(ref.current, slide, preset, brand, {
        slideIndex: 0,
        slideTotal: 5,
        photoUrl: SAMPLE,
      });
    }
  }, [preset, brand]);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
      style={{ aspectRatio: `${preset.width}/${preset.height}` }}
    >
      <canvas ref={ref} className="w-full h-full block" />
    </div>
  );
}
