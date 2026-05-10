export type Colors = {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textOnDark: string;
  textOnLight: string;
};

export type FontSpec = {
  name: string;
  source: 'google' | 'custom';
  url?: string;
  weights: number[];
};

export type Fonts = {
  headline: FontSpec;
  body: FontSpec;
  accent: FontSpec;
};

export type BrandKit = {
  id: string;
  user_id: string;
  name: string;
  logo_url: string;
  colors: Colors;
  fonts: Fonts;
  created_at: string;
  updated_at: string;
};

export type SafeZone = {
  position: 'top' | 'middle' | 'bottom' | 'custom';
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextStyle = {
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  weight: number;
  maxChars: number;
};

export type TextStyles = {
  headline: TextStyle;
  body: TextStyle;
  caption: TextStyle;
};

export type BackgroundOverlay = {
  type: 'none' | 'solid' | 'gradient' | 'blur';
  color: string;
  opacity: number;
  direction: string;
};

export type Margins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  gap: number;
};

export type LogoSettings = {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: number;
  opacity: number;
  visible: boolean;
};

export type IndicatorSettings = {
  visible: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  style: 'dots' | 'numeric';
};

export type Preset = {
  id: string;
  user_id: string;
  brand_kit_id: string | null;
  name: string;
  width: number;
  height: number;
  safe_zones: SafeZone;
  text_styles: TextStyles;
  background_overlay: BackgroundOverlay;
  margins: Margins;
  logo_settings: LogoSettings;
  indicator_settings: IndicatorSettings;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  brand_kit_id: string | null;
  preset_id: string | null;
  idea_text: string;
  carousel_type: 'educational' | 'promotional' | 'story' | 'list';
  status: 'draft' | 'ready' | 'exported';
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SlideOverrides = {
  safe_zone?: SafeZone;
  text_position?: 'top' | 'middle' | 'bottom';
  background_overlay?: Partial<BackgroundOverlay>;
  photo_offset_x?: number;
  photo_offset_y?: number;
  photo_scale?: number;
  text_offset_x?: number;
  text_offset_y?: number;
};

export type Slide = {
  id: string;
  project_id: string;
  order_index: number;
  photo_url: string;
  headline: string;
  body: string;
  caption: string;
  overrides: SlideOverrides;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_FONT: FontSpec = {
  name: 'Inter',
  source: 'google',
  weights: [400, 700],
};
