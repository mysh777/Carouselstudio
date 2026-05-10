import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { toast, ToastItem } from '../lib/toast';

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const unsub = toast.subscribe(setItems);
    return () => {
      unsub();
    };
  }, []);

  const iconFor = (k: ToastItem['kind']) => {
    if (k === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (k === 'error') return <AlertCircle className="w-4 h-4 text-red-600" />;
    return <Info className="w-4 h-4 text-slate-600" />;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={`bg-white border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 ${
            t.kind === 'error' ? 'border-red-200' : t.kind === 'success' ? 'border-emerald-200' : 'border-slate-200'
          }`}
        >
          <div className="mt-0.5">{iconFor(t.kind)}</div>
          <div className="flex-1 text-sm text-slate-800">{t.message}</div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
