import { useEffect, useState } from 'react';
import { Plus, Search, Archive, Trash2, Copy, FolderKanban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BrandKit, DEFAULT_FONT, Preset, Project, Slide } from '../types';
import { getSignedPhotoUrl, removePhotos } from '../lib/storage';
import { dbCall } from '../lib/dbCall';

export default function Projects({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<BrandKit[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [pr, b, ps] = await Promise.all([
      supabase.from('projects').select('*').order('updated_at', { ascending: false }),
      supabase.from('brand_kits').select('*'),
      supabase.from('presets').select('*'),
    ]);
    const projs = (pr.data as Project[]) || [];
    setProjects(projs);
    setBrands((b.data as BrandKit[]) || []);
    setPresets((ps.data as Preset[]) || []);

    if (projs.length) {
      const ids = projs.map((p) => p.id);
      const { data: firstSlides } = await supabase
        .from('slides')
        .select('project_id, photo_url, order_index')
        .in('project_id', ids)
        .eq('order_index', 0);
      const next: Record<string, string> = {};
      for (const s of (firstSlides as Pick<Slide, 'project_id' | 'photo_url'>[]) || []) {
        if (s.photo_url) {
          const url = await getSignedPhotoUrl(s.photo_url);
          if (url) next[s.project_id] = url;
        }
      }
      setCovers(next);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = projects.filter((p) => {
    if (p.archived !== showArchived) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (brandFilter !== 'all' && p.brand_kit_id !== brandFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const create = async () => {
    setCreating(true);
    const user = (await supabase.auth.getUser()).data.user!;
    let brandKitId = brands[0]?.id;
    let presetId = presets[0]?.id;
    if (!brandKitId) {
      const defaults = {
        headline: { ...DEFAULT_FONT, name: 'Inter' },
        body: { ...DEFAULT_FONT, name: 'Inter' },
        accent: { ...DEFAULT_FONT, name: 'Inter' },
      };
      const { data: bk } = await supabase
        .from('brand_kits')
        .insert({ user_id: user.id, name: 'Default Brand', fonts: defaults })
        .select()
        .maybeSingle();
      brandKitId = (bk as BrandKit)?.id;
      if (bk) setBrands((x) => [bk as BrandKit, ...x]);
    }
    if (!presetId) {
      const { data: p } = await supabase
        .from('presets')
        .insert({ user_id: user.id, name: 'Default Preset', brand_kit_id: brandKitId })
        .select()
        .maybeSingle();
      presetId = (p as Preset)?.id;
      if (p) setPresets((x) => [p as Preset, ...x]);
    }
    const data = await dbCall(
      supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: 'Untitled Project',
          brand_kit_id: brandKitId,
          preset_id: presetId,
        })
        .select()
        .maybeSingle(),
      'Failed to create project'
    );
    setCreating(false);
    if (data) onOpen((data as Project).id);
  };

  const duplicate = async (p: Project) => {
    const user = (await supabase.auth.getUser()).data.user!;
    const { data: newP } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: p.name + ' copy',
        brand_kit_id: p.brand_kit_id,
        preset_id: p.preset_id,
        idea_text: p.idea_text,
        carousel_type: p.carousel_type,
      })
      .select()
      .maybeSingle();
    if (newP) {
      const { data: slides } = await supabase
        .from('slides')
        .select('*')
        .eq('project_id', p.id);
      if (slides && slides.length) {
        await supabase.from('slides').insert(
          (slides as Slide[]).map((s) => ({
            project_id: (newP as Project).id,
            order_index: s.order_index,
            photo_url: s.photo_url,
            headline: s.headline,
            body: s.body,
            caption: s.caption,
            overrides: s.overrides,
          }))
        );
      }
      load();
    }
  };

  const archive = async (p: Project, val: boolean) => {
    await supabase.from('projects').update({ archived: val }).eq('id', p.id);
    load();
  };

  const remove = async (p: Project) => {
    if (!confirm('Delete this project and all its photos?')) return;
    const { error: fnError } = await supabase.functions.invoke('cleanup-storage', {
      body: { project_id: p.id },
    });
    if (fnError) {
      const { data: slides } = await supabase
        .from('slides')
        .select('photo_url')
        .eq('project_id', p.id);
      const paths = ((slides as Pick<Slide, 'photo_url'>[]) || [])
        .map((s) => s.photo_url)
        .filter(Boolean);
      if (paths.length) await removePhotos(paths);
    }
    await supabase.from('projects').delete().eq('id', p.id);
    load();
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Projects</h1>
            <p className="text-slate-500 mt-1">Design your Instagram carousels</p>
          </div>
          <button
            onClick={create}
            disabled={creating}
            className="px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-slate-800 disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="exported">Exported</option>
          </select>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`px-3 py-2 text-sm rounded-lg border ${
              showArchived
                ? 'bg-slate-900 text-white border-slate-900'
                : 'border-slate-200 text-slate-700'
            }`}
          >
            {showArchived ? 'Archived' : 'Active'}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-16 text-center">
            <FolderKanban className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <div className="text-slate-500">No projects here yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => {
              const brand = brands.find((b) => b.id === p.brand_kit_id);
              return (
                <div
                  key={p.id}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition"
                >
                  <button
                    onClick={() => onOpen(p.id)}
                    className="w-full aspect-[4/5] bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden"
                  >
                    {covers[p.id] ? (
                      <img src={covers[p.id]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <FolderKanban className="w-10 h-10" />
                    )}
                  </button>
                  <div className="p-4">
                    <div className="font-medium text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          p.status === 'exported'
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.status === 'ready'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {p.status}
                      </span>
                      {brand && <span>· {brand.name}</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      <button
                        onClick={() => onOpen(p.id)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-md text-xs font-medium"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => duplicate(p)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => archive(p, !p.archived)}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(p)}
                        className="p-1.5 hover:bg-red-50 rounded-md text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
