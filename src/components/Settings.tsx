import { useEffect, useState } from 'react';
import { X, Key, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

export default function Settings({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [reveal, setReveal] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data } = await supabase
        .from('user_settings')
        .select('anthropic_api_key')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.anthropic_api_key) {
        setHasKey(true);
        setApiKey(data.anthropic_api_key);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, anthropic_api_key: apiKey || null, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }
    setHasKey(!!apiKey);
    toast.success('Settings saved');
  };

  const clear = async () => {
    if (!confirm('Remove API key?')) return;
    setApiKey('');
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (user) {
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, anthropic_api_key: null, updated_at: new Date().toISOString() });
    }
    setHasKey(false);
    setSaving(false);
    toast.success('API key removed');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-1">
              <Key className="w-4 h-4 text-slate-700" />
              <h3 className="font-medium text-slate-900">Anthropic API key</h3>
              {hasKey && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium uppercase">
                  Configured
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Used for AI text generation. Stored securely per-user. Get one at
              {' '}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:underline"
              >
                console.anthropic.com
              </a>
              .
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="relative">
                  <input
                    type={reveal ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-ant-api03-…"
                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => setReveal((r) => !r)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    type="button"
                  >
                    {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={save}
                    disabled={saving || !apiKey}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                  {hasKey && (
                    <button
                      onClick={clear}
                      className="px-4 py-2 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
