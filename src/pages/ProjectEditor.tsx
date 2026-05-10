import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Upload, Wand2, Trash2, RefreshCw, Download, Plus, Loader2, LayoutGrid as Layout } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BrandKit, Preset, Project, Slide, SlideOverrides } from '../types';
import { fileToResizedBlob, sanitizeFilename, validateUpload } from '../lib/imageUtils';
import { generateCarouselTexts, regenerateOneSlide } from '../lib/aiTexts';
import { renderSlide, slideToBlob } from '../lib/renderSlide';
import { buildZip } from '../lib/zip';
import { dbCall } from '../lib/dbCall';
import { toast } from '../lib/toast';
import { getSignedPhotoUrl, uploadPhoto } from '../lib/storage';
import { useDebouncedSave } from '../hooks/useDebouncedSave';
import { useSlideThumbnails } from '../hooks/useSlideThumbnails';
import { ensureBrandFonts } from '../lib/fontLoader';

export default function ProjectEditor({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [brands, setBrands] = useState<BrandKit[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [slideCount, setSlideCount] = useState(7);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const brand = brands.find((b) => b.id === project?.brand_kit_id) || null;
  const preset = presets.find((p) => p.id === project?.preset_id) || null;
  const activeSlide = slides[activeIdx] || null;

  const load = useCallback(async () => {
    const [pr, sl, b, ps] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).maybeSingle(),
      supabase.from('slides').select('*').eq('project_id', projectId).order('order_index'),
      supabase.from('brand_kits').select('*'),
      supabase.from('presets').select('*'),
    ]);
    if (pr.error) toast.error(`Failed to load project: ${pr.error.message}`);
    setProject(pr.data as Project);
    setSlides((sl.data as Slide[]) || []);
    setBrands((b.data as BrandKit[]) || []);
    setPresets((ps.data as Preset[]) || []);
    if (pr.data) setSlideCount(((sl.data as Slide[]) || []).length || 7);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve signed URLs for photos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending: Record<string, string> = {};
      for (const s of slides) {
        if (s.photo_url && !photoUrls[s.photo_url]) {
          const url = await getSignedPhotoUrl(s.photo_url);
          if (url) pending[s.photo_url] = url;
        }
      }
      if (!cancelled && Object.keys(pending).length) {
        setPhotoUrls((p) => ({ ...p, ...pending }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  // Preload fonts when brand changes
  useEffect(() => {
    if (brand?.fonts) ensureBrandFonts(brand.fonts).catch(() => {});
  }, [brand]);

  // Render active slide
  useEffect(() => {
    if (canvasRef.current && activeSlide && preset) {
      const url = activeSlide.photo_url ? photoUrls[activeSlide.photo_url] : undefined;
      renderSlide(canvasRef.current, activeSlide, preset, brand, {
        slideIndex: activeIdx,
        slideTotal: slides.length,
        photoUrl: url || null,
      });
    }
  }, [activeSlide, preset, brand, activeIdx, slides.length, photoUrls]);

  const thumbs = useSlideThumbnails(slides, preset, brand, photoUrls);

  // Debounced project metadata save
  const { saving: savingProject, saveNow: saveProjectNow } = useDebouncedSave(
    project,
    async (v) => {
      if (!v) return;
      const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = v;
      void _u;
      void _c;
      void _up;
      await dbCall(
        supabase.from('projects').update(rest).eq('id', id).select().maybeSingle(),
        'Failed to save project'
      );
    },
    600
  );

  // Debounced slide save (active slide only)
  const { saving: savingSlide, saveNow: saveSlideNow } = useDebouncedSave(
    activeSlide,
    async (v) => {
      if (!v) return;
      const { id, project_id: _p, created_at: _c, updated_at: _up, ...rest } = v;
      void _p;
      void _c;
      void _up;
      await dbCall(
        supabase.from('slides').update(rest).eq('id', id).select().maybeSingle(),
        'Failed to save slide'
      );
    },
    600
  );

  const saving = savingProject || savingSlide;

  const activeSlideId = activeSlide?.id;
  useEffect(() => {
    saveSlideNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideId]);

  const handleBack = async () => {
    await Promise.all([saveSlideNow(), saveProjectNow()]);
    onBack();
  };

  const updateProject = (patch: Partial<Project>) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
  };

  const updateSlide = (id: string, patch: Partial<Slide>) => {
    setSlides((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const handleUploadPhotos = async (files: FileList | null) => {
    toast.success(`Upload: got ${files?.length ?? 0} file(s)`);
    if (!files || !project) {
      toast.error('No project loaded');
      return;
    }
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast.error('Not signed in');
      return;
    }
    const arr = Array.from(files).slice(0, 10 - slides.length);
    const baseOrder = slides.length;
    let offset = 0;
    for (const file of arr) {
      const err = validateUpload(file);
      if (err) {
        toast.error(err);
        continue;
      }
      try {
        const { blob } = await fileToResizedBlob(file);
        const order = baseOrder + offset;
        const { data: inserted, error: insertErr } = await supabase
          .from('slides')
          .insert({
            project_id: project.id,
            order_index: order,
            photo_url: '',
            headline: '',
            body: '',
            caption: '',
            overrides: {},
          })
          .select()
          .maybeSingle();
        if (insertErr || !inserted) {
          toast.error(`Failed to create slide: ${insertErr?.message || 'unknown'}`);
          continue;
        }
        const path = await uploadPhoto(userId, project.id, (inserted as Slide).id, blob);
        if (!path) {
          toast.error('Photo upload failed (storage)');
          await supabase.from('slides').delete().eq('id', (inserted as Slide).id);
          continue;
        }
        await supabase.from('slides').update({ photo_url: path }).eq('id', (inserted as Slide).id);
        const signed = await getSignedPhotoUrl(path);
        if (signed) setPhotoUrls((p) => ({ ...p, [path]: signed }));
        setSlides((s) => [...s, { ...(inserted as Slide), photo_url: path }]);
        offset++;
      } catch (e) {
        console.error('upload failed', e);
        toast.error(e instanceof Error ? e.message : 'Upload failed');
      }
    }
  };

  const generateTexts = async () => {
    if (!preset || !project || slides.length === 0) {
      toast.error('Upload photos first');
      return;
    }
    if (!project.idea_text.trim()) {
      toast.error('Enter an idea first');
      return;
    }
    await saveSlideNow();
    setGenerating(true);
    const count = Math.min(slideCount, slides.length);
    try {
      const texts = await generateCarouselTexts(
        project.idea_text,
        count,
        preset,
        project.carousel_type
      );
      for (let i = 0; i < count; i++) {
        const t = texts[i];
        if (!t) continue;
        await supabase
          .from('slides')
          .update({ headline: t.headline, body: t.body, caption: t.caption })
          .eq('id', slides[i].id);
        updateSlide(slides[i].id, { headline: t.headline, body: t.body, caption: t.caption });
      }
      updateProject({ status: 'ready' });
      toast.success('Texts generated');
    } catch (e) {
      toast.error(
        `Generation unavailable: ${e instanceof Error ? e.message : 'unknown error'}`
      );
    } finally {
      setGenerating(false);
    }
  };

  const regenerateOne = async (idx: number) => {
    if (!preset || !project) return;
    await saveSlideNow();
    setRegenIdx(idx);
    try {
      const current = slides.map((s) => ({
        headline: s.headline,
        body: s.body,
        caption: s.caption,
      }));
      const t = await regenerateOneSlide(
        project.idea_text,
        current,
        idx,
        preset,
        project.carousel_type
      );
      await supabase
        .from('slides')
        .update({ headline: t.headline, body: t.body, caption: t.caption })
        .eq('id', slides[idx].id);
      updateSlide(slides[idx].id, { headline: t.headline, body: t.body, caption: t.caption });
    } catch (e) {
      toast.error(`Regeneration failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setRegenIdx(null);
    }
  };

  const deleteSlide = useCallback(
    async (id: string) => {
      if (!confirm('Delete this slide?')) return;
      const slide = slides.find((s) => s.id === id);
      await supabase.from('slides').delete().eq('id', id);
      if (slide?.photo_url) {
        supabase.storage.from('carousel-photos').remove([slide.photo_url]);
      }
      const next = slides.filter((s) => s.id !== id);
      await Promise.all(
        next.map((s, i) =>
          i !== s.order_index
            ? supabase.from('slides').update({ order_index: i }).eq('id', s.id)
            : null
        )
      );
      setSlides(next.map((s, i) => ({ ...s, order_index: i })));
      setActiveIdx((i) => Math.max(0, Math.min(i, next.length - 1)));
    },
    [slides]
  );

  const moveSlide = async (from: number, to: number) => {
    if (to < 0 || to >= slides.length || from === to) return;
    const reord = [...slides];
    const [m] = reord.splice(from, 1);
    reord.splice(to, 0, m);
    setSlides(reord.map((s, i) => ({ ...s, order_index: i })));
    await Promise.all(
      reord.map((s, i) => supabase.from('slides').update({ order_index: i }).eq('id', s.id))
    );
    setActiveIdx(to);
  };

  const duplicateActive = useCallback(async () => {
    if (!activeSlide || !project) return;
    const newOrder = slides.length;
    const { data } = await supabase
      .from('slides')
      .insert({
        project_id: project.id,
        order_index: newOrder,
        photo_url: activeSlide.photo_url,
        headline: activeSlide.headline,
        body: activeSlide.body,
        caption: activeSlide.caption,
        overrides: activeSlide.overrides,
      })
      .select()
      .maybeSingle();
    if (data) setSlides((s) => [...s, data as Slide]);
  }, [activeSlide, slides.length, project]);

  const doExport = async () => {
    if (!preset || slides.length === 0) return;
    setExporting(true);
    try {
      if (brand?.fonts) await ensureBrandFonts(brand.fonts);
      const entries: { name: string; data: Uint8Array }[] = [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const url = s.photo_url ? (photoUrls[s.photo_url] || (await getSignedPhotoUrl(s.photo_url))) : null;
        const blob = await slideToBlob(s, preset, brand, {
          slideIndex: i,
          slideTotal: slides.length,
          photoUrl: url,
        });
        const ab = await blob.arrayBuffer();
        entries.push({
          name: `${String(i + 1).padStart(2, '0')}.png`,
          data: new Uint8Array(ab),
        });
      }
      const zip = buildZip(entries);
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeFilename(project?.name || 'carousel')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      updateProject({ status: 'exported' });
      toast.success('Exported');
    } catch (e) {
      toast.error(`Export failed: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setExporting(false);
    }
  };

  // Hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'd' && !inField) {
        e.preventDefault();
        duplicateActive();
      } else if (mod && e.key === 'Enter') {
        e.preventDefault();
        generateTexts();
      } else if (!inField && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (activeSlide) {
          e.preventDefault();
          deleteSlide(activeSlide.id);
        }
      } else if (!inField && e.key === 'ArrowLeft') {
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (!inField && e.key === 'ArrowRight') {
        setActiveIdx((i) => Math.min(slides.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlide, slides.length]);

  if (!project || !preset) {
    return (
      <div className="p-8 text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input
          value={project.name}
          onChange={(e) => updateProject({ name: e.target.value })}
          className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none flex-1 min-w-0"
        />
        <span className="text-xs text-slate-400 min-w-[60px] text-right">
          {saving ? 'Saving…' : 'Saved'}
        </span>
        <select
          value={project.brand_kit_id || ''}
          onChange={(e) => updateProject({ brand_kit_id: e.target.value || null })}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Brand…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={project.preset_id || ''}
          onChange={(e) => updateProject({ preset_id: e.target.value || null })}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Preset…</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={doExport}
          disabled={exporting || slides.length === 0}
          className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-52 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 uppercase">Slides</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={slides.length >= 10}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600 disabled:opacity-40"
              title="Add photos"
            >
              <Plus className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                handleUploadPhotos(e.target.files);
                e.currentTarget.value = '';
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {slides.map((s, i) => {
              const hasOverride =
                s.overrides &&
                (s.overrides.safe_zone ||
                  s.overrides.text_position ||
                  s.overrides.background_overlay);
              return (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(i);
                  }}
                  onDragEnd={() => {
                    if (dragIdx !== null && overIdx !== null) moveSlide(dragIdx, overIdx);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onClick={() => setActiveIdx(i)}
                  className={`cursor-pointer rounded-lg border-2 overflow-hidden relative group transition ${
                    activeIdx === i ? 'border-slate-900' : 'border-transparent'
                  } ${overIdx === i && dragIdx !== i ? 'ring-2 ring-sky-400' : ''} ${
                    dragIdx === i ? 'opacity-40' : ''
                  }`}
                >
                  <div
                    className="bg-slate-200 w-full"
                    style={{ aspectRatio: `${preset.width}/${preset.height}` }}
                  >
                    {thumbs[s.id] ? (
                      <img src={thumbs[s.id]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                    {i + 1}
                  </div>
                  {hasOverride && (
                    <div
                      className="absolute top-1 right-7 bg-amber-500 text-white text-[10px] px-1 py-0.5 rounded"
                      title="Modified"
                    >
                      mod
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSlide(s.id);
                    }}
                    className="absolute top-1 right-1 bg-white/90 hover:bg-white p-0.5 rounded text-red-600 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            {slides.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[4/5] border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 hover:text-slate-600"
              >
                <Upload className="w-6 h-6 mb-1" />
                <span className="text-xs">Upload photos</span>
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          {slides.length === 0 ? (
            <div className="max-w-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">
                Upload 2–10 photos to start
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                JPG, PNG, or WebP up to 10 MB, minimum 800×800.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium"
              >
                Upload photos
              </button>
            </div>
          ) : (
            <div
              className="bg-white rounded-xl shadow-md overflow-hidden"
              style={{
                height: '100%',
                maxHeight: '75vh',
                aspectRatio: `${preset.width}/${preset.height}`,
              }}
            >
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          )}
        </main>

        <aside className="w-80 bg-white border-l border-slate-200 overflow-y-auto">
          <div className="p-5 space-y-5">
            <section>
              <h3 className="text-xs font-medium text-slate-500 uppercase mb-2">Idea</h3>
              <textarea
                value={project.idea_text}
                onChange={(e) => updateProject({ idea_text: e.target.value })}
                placeholder="Describe your carousel idea…"
                rows={6}
                maxLength={2000}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              />
              <div className="flex items-center gap-2 mt-2">
                <select
                  value={project.carousel_type}
                  onChange={(e) =>
                    updateProject({
                      carousel_type: e.target.value as Project['carousel_type'],
                    })
                  }
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs"
                >
                  <option value="educational">Educational</option>
                  <option value="promotional">Promotional</option>
                  <option value="story">Story</option>
                  <option value="list">List</option>
                </select>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 border border-slate-200 rounded text-xs"
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Generates text for {Math.min(slideCount, slides.length)} slides
              </div>
              <button
                onClick={generateTexts}
                disabled={generating || !project.idea_text || slides.length === 0}
                className="w-full mt-3 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-800 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Generate all texts
              </button>
            </section>

            {activeSlide && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-slate-500 uppercase">
                      Slide {activeIdx + 1}
                    </h3>
                    <button
                      onClick={() => regenerateOne(activeIdx)}
                      disabled={regenIdx === activeIdx}
                      className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 disabled:opacity-40"
                    >
                      {regenIdx === activeIdx ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Regenerate
                    </button>
                  </div>
                  <div className="space-y-3">
                    <TextField
                      label="Headline"
                      value={activeSlide.headline}
                      max={preset.text_styles.headline.maxChars}
                      onChange={(v) => updateSlide(activeSlide.id, { headline: v })}
                    />
                    <TextField
                      label="Body"
                      value={activeSlide.body}
                      max={preset.text_styles.body.maxChars}
                      onChange={(v) => updateSlide(activeSlide.id, { body: v })}
                      multiline
                    />
                    <TextField
                      label="Caption"
                      value={activeSlide.caption}
                      max={preset.text_styles.caption.maxChars}
                      onChange={(v) => updateSlide(activeSlide.id, { caption: v })}
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-medium text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                    <Layout className="w-3 h-3" /> Layout override
                  </h3>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['top', 'middle', 'bottom'] as const).map((p) => {
                      const active = activeSlide.overrides?.text_position === p;
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            updateSlide(activeSlide.id, {
                              overrides: {
                                ...(activeSlide.overrides as SlideOverrides),
                                text_position: p,
                                safe_zone: undefined,
                              },
                            })
                          }
                          className={`px-2 py-1.5 text-xs capitalize rounded border ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => updateSlide(activeSlide.id, { overrides: {} })}
                    className="w-full mt-2 text-xs text-slate-500 hover:text-slate-900 py-1"
                  >
                    Reset to preset
                  </button>
                </section>
              </>
            )}
          </div>
        </aside>
      </div>

      {slides.length > 0 && (
        <div className="bg-white border-t border-slate-200 p-3 overflow-x-auto">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActiveIdx(i)}
                className={`flex-shrink-0 rounded border-2 overflow-hidden ${
                  activeIdx === i ? 'border-slate-900' : 'border-slate-200'
                }`}
                style={{ width: 72, aspectRatio: `${preset.width}/${preset.height}` }}
              >
                {thumbs[s.id] && (
                  <img src={thumbs[s.id]} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  max,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const over = value.length > max;
  const Comp: 'input' | 'textarea' = multiline ? 'textarea' : 'input';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        <span className={`text-xs ${over ? 'text-red-600' : 'text-slate-400'}`}>
          {value.length}/{max}
        </span>
      </div>
      <Comp
        value={value}
        rows={multiline ? 3 : undefined}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        className={`w-full px-3 py-2 border rounded-lg text-sm ${
          over ? 'border-red-300' : 'border-slate-200'
        } ${multiline ? 'resize-none' : ''}`}
      />
    </div>
  );
}
