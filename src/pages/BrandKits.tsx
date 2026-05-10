import { useEffect, useState } from 'react';
import { Plus, Trash2, Palette, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BrandKit, DEFAULT_FONT, FontSpec } from '../types';
import { dbCall } from '../lib/dbCall';
import { toast } from '../lib/toast';
import { useDebouncedSave } from '../hooks/useDebouncedSave';
import { ensureFontSpec } from '../lib/fontLoader';
import { uploadFont } from '../lib/storage';

const GOOGLE_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Nunito',
  'Oswald',
  'Playfair Display',
  'Merriweather',
  'Source Sans 3',
  'PT Sans',
  'Ubuntu',
  'Work Sans',
  'Bebas Neue',
  'Archivo',
  'DM Sans',
  'DM Serif Display',
  'Manrope',
  'Space Grotesk',
  'Rubik',
  'Karla',
  'Lora',
  'Fira Sans',
  'Josefin Sans',
  'Quicksand',
  'Barlow',
  'IBM Plex Sans',
  'IBM Plex Serif',
];

export default function BrandKits() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selected = kits.find((k) => k.id === selectedId) || null;

  const load = async () => {
    setLoading(true);
    const data = await dbCall(
      supabase.from('brand_kits').select('*').order('created_at', { ascending: false }),
      'Failed to load brand kits'
    );
    setKits((data as BrandKit[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const user = (await supabase.auth.getUser()).data.user!;
    const defaults = {
      headline: { ...DEFAULT_FONT, name: 'Inter' },
      body: { ...DEFAULT_FONT, name: 'Inter' },
      accent: { ...DEFAULT_FONT, name: 'Inter' },
    };
    const data = await dbCall(
      supabase
        .from('brand_kits')
        .insert({ name: 'New Brand', user_id: user.id, fonts: defaults })
        .select()
        .maybeSingle(),
      'Failed to create brand kit'
    );
    if (data) {
      setKits((k) => [data as BrandKit, ...k]);
      setSelectedId((data as BrandKit).id);
    }
  };

  const patch = (p: Partial<BrandKit>) => {
    if (!selected) return;
    setKits((k) => k.map((x) => (x.id === selected.id ? { ...x, ...p } : x)));
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
        supabase.from('brand_kits').update(rest).eq('id', id).select().maybeSingle(),
        'Failed to save brand kit'
      );
    },
    600
  );

  const remove = async (id: string) => {
    if (!confirm('Delete this brand kit?')) return;
    await dbCall(supabase.from('brand_kits').delete().eq('id', id).select().maybeSingle(), 'Failed to delete');
    setKits((k) => k.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="flex h-full">
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Brand Kits</h2>
          <button
            onClick={create}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-sm flex items-center gap-1.5 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-slate-500">Loading…</div>
          ) : kits.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              <Palette className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No brand kits yet
            </div>
          ) : (
            kits.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelectedId(k.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${
                  selectedId === k.id ? 'bg-slate-50' : ''
                }`}
              >
                <div className="font-medium text-slate-900 text-sm">{k.name}</div>
                <div className="flex gap-1 mt-1.5">
                  {(['primary', 'secondary', 'accent', 'text'] as const).map((c) => (
                    <div
                      key={c}
                      className="w-4 h-4 rounded border border-slate-200"
                      style={{ background: k.colors[c] }}
                    />
                  ))}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
        {selected ? (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between gap-3">
              <input
                value={selected.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="text-2xl font-semibold text-slate-900 bg-transparent border-none outline-none flex-1"
              />
              <span className="text-xs text-slate-400">{saving ? 'Saving…' : 'Saved'}</span>
              <button
                onClick={() => remove(selected.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <ColorsSection selected={selected} patch={patch} />
            <FontsSection selected={selected} patch={patch} />
            <LogoSection selected={selected} patch={patch} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            Select a brand kit or create one
          </div>
        )}
      </div>
    </div>
  );
}

function ColorsSection({
  selected,
  patch,
}: {
  selected: BrandKit;
  patch: (p: Partial<BrandKit>) => void;
}) {
  const keys: (keyof BrandKit['colors'])[] = [
    'primary',
    'secondary',
    'accent',
    'text',
    'textOnDark',
    'textOnLight',
  ];
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Colors</h3>
      <div className="grid grid-cols-2 gap-4">
        {keys.map((c) => (
          <div key={c}>
            <label className="text-xs text-slate-600 block mb-1 capitalize">{c}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={selected.colors[c]}
                onChange={(e) => patch({ colors: { ...selected.colors, [c]: e.target.value } })}
                className="w-10 h-10 rounded cursor-pointer border border-slate-200"
              />
              <input
                value={selected.colors[c]}
                onChange={(e) => patch({ colors: { ...selected.colors, [c]: e.target.value } })}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FontsSection({
  selected,
  patch,
}: {
  selected: BrandKit;
  patch: (p: Partial<BrandKit>) => void;
}) {
  const slots: (keyof BrandKit['fonts'])[] = ['headline', 'body', 'accent'];
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Fonts</h3>
      <div className="space-y-6">
        {slots.map((slot) => (
          <FontSlot
            key={slot}
            slot={slot}
            value={selected.fonts[slot]}
            userId={selected.user_id}
            onChange={(v) => patch({ fonts: { ...selected.fonts, [slot]: v } })}
          />
        ))}
      </div>
    </section>
  );
}

function FontSlot({
  slot,
  value,
  userId,
  onChange,
}: {
  slot: string;
  value: FontSpec;
  userId: string;
  onChange: (v: FontSpec) => void;
}) {
  const [livePreview, setLivePreview] = useState(false);

  useEffect(() => {
    setLivePreview(false);
    ensureFontSpec(value).then(() => setLivePreview(true)).catch(() => setLivePreview(true));
  }, [value]);

  const toggleWeight = (w: number) => {
    const exists = value.weights.includes(w);
    const weights = exists ? value.weights.filter((x) => x !== w) : [...value.weights, w].sort();
    onChange({ ...value, weights: weights.length ? weights : [400] });
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    if (!/\.(woff2|woff|ttf|otf)$/i.test(file.name)) {
      toast.error('Font must be .woff2, .woff, .ttf, or .otf');
      return;
    }
    const fontName = file.name.replace(/\.(woff2|woff|ttf|otf)$/i, '');
    const res = await uploadFont(userId, fontName, file);
    if (!res) {
      toast.error('Font upload failed');
      return;
    }
    onChange({ name: fontName, source: 'custom', url: res.path, weights: [400, 700] });
    toast.success('Font uploaded');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-slate-700 capitalize">{slot}</div>
        <div className="flex gap-1 bg-slate-100 p-0.5 rounded">
          <button
            onClick={() => onChange({ ...value, source: 'google' })}
            className={`px-2 py-1 text-xs rounded ${value.source === 'google' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'}`}
          >
            Google
          </button>
          <button
            onClick={() => onChange({ ...value, source: 'custom' })}
            className={`px-2 py-1 text-xs rounded ${value.source === 'custom' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'}`}
          >
            Custom
          </button>
        </div>
      </div>
      {value.source === 'google' ? (
        <div className="flex gap-2">
          <select
            value={GOOGLE_FONTS.includes(value.name) ? value.name : '__custom'}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== '__custom') onChange({ ...value, name: v });
            }}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            {GOOGLE_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: `"${f}", sans-serif` }}>
                {f}
              </option>
            ))}
            <option value="__custom">Other (type name)…</option>
          </select>
          {!GOOGLE_FONTS.includes(value.name) && (
            <input
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              placeholder="Font name"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          )}
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 cursor-pointer">
          <Upload className="w-4 h-4" />
          <span className="truncate flex-1">{value.name || 'Upload .woff2 / .ttf'}</span>
          <input
            type="file"
            accept=".woff2,.woff,.ttf,.otf"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
        </label>
      )}
      <div className="flex items-center gap-2 mt-2">
        {[300, 400, 500, 600, 700, 800].map((w) => (
          <button
            key={w}
            onClick={() => toggleWeight(w)}
            className={`px-2 py-1 text-xs rounded border ${
              value.weights.includes(w)
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <div
        className="mt-3 p-3 border border-slate-200 rounded-lg text-2xl text-slate-900 bg-slate-50 min-h-[56px]"
        style={{
          fontFamily: livePreview ? `"${value.name}", sans-serif` : 'sans-serif',
          fontWeight: value.weights[0] || 400,
        }}
      >
        The quick brown fox
      </div>
    </div>
  );
}

function LogoSection({
  selected,
  patch,
}: {
  selected: BrandKit;
  patch: (p: Partial<BrandKit>) => void;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-900 mb-4">Logo</h3>
      <input
        value={selected.logo_url}
        onChange={(e) => patch({ logo_url: e.target.value })}
        placeholder="https://… PNG or SVG URL"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
      />
      {selected.logo_url && (
        <img src={selected.logo_url} alt="logo" className="mt-3 h-16 object-contain" />
      )}
    </section>
  );
}
