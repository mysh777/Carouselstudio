import { useEffect, useRef, useState } from 'react';

export function useDebouncedSave<T>(
  value: T,
  saveFn: (v: T) => Promise<void>,
  delay = 600
) {
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<T>(value);
  const pendingSaveValue = useRef<T | null>(null);
  const hasPending = useRef(false);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;
  const isFirst = useRef(true);

  useEffect(() => {
    const prevPending = hasPending.current ? pendingSaveValue.current : null;
    const prevHadPending = hasPending.current;

    latest.current = value;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    if (prevHadPending && !Object.is(prevPending, value)) {
      if (timer.current) clearTimeout(timer.current);
      hasPending.current = false;
      const toFlush = prevPending as T;
      (async () => {
        setSaving(true);
        try {
          await saveFnRef.current(toFlush);
        } finally {
          setSaving(false);
        }
      })();
    }

    setDirty(true);
    pendingSaveValue.current = value;
    hasPending.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const toSave = pendingSaveValue.current as T;
      hasPending.current = false;
      setSaving(true);
      try {
        await saveFnRef.current(toSave);
        setDirty(false);
      } finally {
        setSaving(false);
      }
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  const saveNow = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!hasPending.current) return;
    const toSave = pendingSaveValue.current as T;
    hasPending.current = false;
    setSaving(true);
    try {
      await saveFnRef.current(toSave);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || saving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saving]);

  return { saving, dirty, saveNow };
}
