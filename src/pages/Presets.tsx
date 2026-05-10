import { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BrandKit, Preset } from '../types';
import PresetPreview from '../components/PresetPreview';
import { dbCall } from '../lib/dbCall';
import { useDebouncedSave } from '../hooks/useDebouncedSave';

export default function Presets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [brands, setBrands] = useState<BrandKit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = presets.find((p) => p.id === selectedId) || null;

  const load = async () => {
    const [p, b] = await Promise.all([
      supabase.from('presets').select('*').order('created_at', { ascending: false }),
      supabase.from('brand_kits').select('*').order('created_at', { ascending: false }),
    ]);
    setPresets((p.data as Preset[]) || []);
    setBrands((b.data as BrandKit[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const data = await dbCall(
      supabase
        .from('presets')
        .insert({ user_id: user.id, name: 'New Preset', brand_kit_id: brands[0]?.id ?? null })
        .select()
        .maybeSingle(),
      'Failed to create preset'
    );
    if (data) {
      setPresets((x) => [data as Preset, ...x]);
      setSelectedId((data as Preset).id);
    }
  };

  const duplicate = async (p: Preset) => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { id, created_at, updated_at, ...rest } = p;
    void id;
    void created_at;
    void updated_at;
    const data = await dbCall(
      supabase
        .from('presets')
        .insert({ ...rest, user_id: user.id, name: p.name + ' copy' })
        .select()
        .maybeSingle(),
      'Failed to duplicate'
    );
    if (data) setPresets((x) => [data as Preset, ...x]);
  };

  const patch = (p: Partial<Preset>) => {
    if (!selected) return;
    setPresets((arr) => arr.map((x) => (x.id === selected.id ? { ...x, ...p } : x)));
  };

  const { saving } = useDebouncedSave(
    selected,
    async (v) => {
      if (!v) return;
      const { id, user_id: _u, created_at: _c, updated_at: _up, ...rest } = v;
      void _u;
      void _c;
      void _up;
      await dbCall(
        supabase.from('presets').update(rest).eq('id', id).select().maybeSingle(),
        'Failed to save preset'
      );
    },
    600
  );

  const remove = async (id: string) => {
    if (!confirm('Delete this preset?')) return;
    await dbCall(supabase.from('presets').delete().eq('id', id).select().maybeSingle(), 'Delete failed');
    setPresets((p) => p.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const resize = (w: number, h: number) => {
    if (!selected) return;
    if (selected.width === w && selected.height === h) return;
    const adapt = confirm('Scale text sizes and margins proportionally to the new canvas?');
    if (adapt) {
      const ratio = h / selected.height;
      patch({
        width: w,
        height: h,
        text_styles: {
          headline: { ...selected.text_styles.headline, size: Math.round(selected.text_styles.headline.size * ratio) },
          body: { ...selected.text_styles.body, size: Math.round(selected.text_styles.body.size * ratio) },
          caption: { ...selected.text_styles.caption, size: Math.round(selected.text_styles.caption.size * ratio) },
        },
        margins: {
          ...selected.margins,
          top: Math.round(selected.margins.top * ratio),
          right: Math.round(selected.margins.right * ratio),
          bottom: Math.round(selected.margins.bottom * ratio),
          left: Math.round(selected.margins.left * ratio),
          gap: Math.round(selected.margins.gap * ratio),
        },
      });
    } else {
      patch({ width: w, height: h });
    }
  };

  const brand = brands.find((b) => b.id === selected?.brand_kit_id) || null;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Presets</h2>
          <button
            onClick={create}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {presets.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No presets yet
            </div>
          ) : (
            presets.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                  selectedId === p.id ? 'bg-slate-50' : ''
                }`}
              >
                <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {p.width}×{p.height}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
        {selected ? (
          <div className="max-w-4xl grid grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <input
                  value={selected.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  className="text-2xl font-semibold text-slate-900 bg-transparent border-none outline-none flex-1"
                />
                <span className="text-xs text-slate-400">{saving ? 'Saving…' : 'Saved'}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => duplicate(selected)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(selected.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Brand kit</h3>
                <select
                  value={selected.brand_kit_id || ''}
                  onChange={(e) => patch({ brand_kit_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">None</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Canvas size</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    [1080, 1350, '4:5'],
                    [1080, 1080, '1:1'],
                    [1080, 1920, '9:16'],
                  ].map(([w, h, l]) => (
                    <button
                      key={l as string}
                      onClick={() => resize(w as number, h as number)}
                      className={`py-2 text-sm rounded-lg border ${
                        selected.width === w && selected.height === h
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Safe zone (%)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <div key={k}>
                      <label className="text-xs text-slate-600 uppercase">{k}</label>
                      <input
                        type="number"
                        value={selected.safe_zones[k]}
                        onChange={(e) =>
                          patch({
                            safe_zones: { ...selected.safe_zones, [k]: Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Overlay</h3>
                <div className="space-y-2">
                  <select
                    value={selected.background_overlay.type}
                    onChange={(e) =>
                      patch({
                        background_overlay: {
                          ...selected.background_overlay,
                          type: e.target.value as Preset['background_overlay']['type'],
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="gradient">Gradient</option>
                    <option value="blur">Blur photo</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selected.background_overlay.color}
                      onChange={(e) =>
                        patch({
                          background_overlay: {
                            ...selected.background_overlay,
                            color: e.target.value,
                          },
                        })
                      }
                      className="w-10 h-10 rounded border border-slate-200"
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={selected.background_overlay.opacity}
                      onChange={(e) =>
                        patch({
                          background_overlay: {
                            ...selected.background_overlay,
                            opacity: Number(e.target.value),
                          },
                        })
                      }
                      className="flex-1"
                    />
                    <span className="text-xs w-10 text-right text-slate-500">
                      {Math.round(selected.background_overlay.opacity * 100)}%
                    </span>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Text styles</h3>
                {(['headline', 'body', 'caption'] as const).map((k) => (
                  <div key={k} className="mb-4 last:mb-0">
                    <div className="text-xs font-medium text-slate-600 capitalize mb-2">{k}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-500">Size</label>
                        <input
                          type="number"
                          value={selected.text_styles[k].size}
                          onChange={(e) =>
                            patch({
                              text_styles: {
                                ...selected.text_styles,
                                [k]: { ...selected.text_styles[k], size: Number(e.target.value) },
                              },
                            })
                          }
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Color</label>
                        <input
                          type="color"
                          value={selected.text_styles[k].color}
                          onChange={(e) =>
                            patch({
                              text_styles: {
                                ...selected.text_styles,
                                [k]: { ...selected.text_styles[k], color: e.target.value },
                              },
                            })
                          }
                          className="w-full h-8 border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Max chars</label>
                        <input
                          type="number"
                          value={selected.text_styles[k].maxChars}
                          onChange={(e) =>
                            patch({
                              text_styles: {
                                ...selected.text_styles,
                                [k]: { ...selected.text_styles[k], maxChars: Number(e.target.value) },
                              },
                            })
                          }
                          className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3 text-sm">Indicator</h3>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.indicator_settings.visible}
                      onChange={(e) =>
                        patch({
                          indicator_settings: {
                            ...selected.indicator_settings,
                            visible: e.target.checked,
                          },
                        })
                      }
                    />
                    Visible
                  </label>
                  <select
                    value={selected.indicator_settings.style}
                    onChange={(e) =>
                      patch({
                        indicator_settings: {
                          ...selected.indicator_settings,
                          style: e.target.value as 'dots' | 'numeric',
                        },
                      })
                    }
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="numeric">Numeric</option>
                    <option value="dots">Dots</option>
                  </select>
                </div>
              </section>
            </div>
            <div>
              <div className="sticky top-0">
                <div className="text-xs font-medium text-slate-500 uppercase mb-3">Preview</div>
                <PresetPreview preset={selected} brand={brand} />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            Select a preset or create one
          </div>
        )}
      </div>
    </div>
  );
}
