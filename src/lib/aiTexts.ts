import { supabase } from './supabase';
import { Preset } from '../types';

export type DistributedSlide = {
  headline: string;
  body: string;
  caption: string;
};

function limitsFor(preset: Preset) {
  return {
    headline: { maxChars: preset.text_styles.headline.maxChars },
    body: { maxChars: preset.text_styles.body.maxChars },
    caption: { maxChars: preset.text_styles.caption.maxChars },
  };
}

export async function generateCarouselTexts(
  idea: string,
  slideCount: number,
  preset: Preset,
  carouselType: string
): Promise<DistributedSlide[]> {
  const { data, error } = await supabase.functions.invoke('generate-carousel-texts', {
    body: {
      idea_text: idea,
      slide_count: slideCount,
      carousel_type: carouselType,
      text_limits: limitsFor(preset),
    },
  });
  if (error) throw new Error(error.message || 'Generation failed');
  if (!data?.slides) throw new Error(data?.error || 'Empty response');
  return data.slides.map((s: { headline: string; body: string; caption: string }) => ({
    headline: s.headline,
    body: s.body,
    caption: s.caption,
  }));
}

export async function regenerateOneSlide(
  idea: string,
  slides: { headline: string; body: string; caption: string }[],
  targetIndex: number,
  preset: Preset,
  carouselType: string
): Promise<DistributedSlide> {
  const { data, error } = await supabase.functions.invoke('regenerate-single-slide', {
    body: {
      idea_text: idea,
      slide_count: slides.length,
      slides,
      target_index: targetIndex,
      text_limits: limitsFor(preset),
      carousel_type: carouselType,
    },
  });
  if (error) throw new Error(error.message || 'Generation failed');
  if (!data?.slide) throw new Error(data?.error || 'Empty response');
  return data.slide;
}
