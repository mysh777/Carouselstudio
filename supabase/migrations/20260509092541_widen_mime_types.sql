/*
  # Widen allowed MIME types for storage buckets

  Some browsers/OSes send unexpected or empty MIME types for common formats.
  This migration widens the allowlist so uploads don't fail unnecessarily.

  Changes:
  - carousel-photos: add HEIC/HEIF and application/octet-stream
  - fonts: add common alternate font MIME types and application/octet-stream
*/

UPDATE storage.buckets
  SET allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'image/heic', 'image/heif',
    'application/octet-stream'
  ]::text[]
  WHERE id = 'carousel-photos';

UPDATE storage.buckets
  SET allowed_mime_types = ARRAY[
    'font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'font/sfnt',
    'application/x-font-ttf', 'application/x-font-woff', 'application/x-font-woff2',
    'application/font-woff2',
    'application/octet-stream'
  ]::text[]
  WHERE id = 'fonts';
