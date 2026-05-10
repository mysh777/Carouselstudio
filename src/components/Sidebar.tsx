import { Images, Palette, Layers, LogOut, FolderKanban } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type View = 'projects' | 'brands' | 'presets';

export default function Sidebar({
  view,
  setView,
  user,
}: {
  view: View;
  setView: (v: View) => void;
  user: User;
}) {
  const items: { id: View; label: string; icon: typeof Images }[] = [
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'brands', label: 'Brand Kits', icon: Palette },
    { id: 'presets', label: 'Presets', icon: Layers },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
          <Images className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">Carousel Studio</div>
          <div className="text-xs text-slate-500">v1.0</div>
        </div>
      </div>
      <nav className="flex-1 px-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = view === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setView(it.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition ${
                active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {it.label}
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500">Signed in</div>
            <div className="text-sm text-slate-900 truncate">{user.email}</div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
