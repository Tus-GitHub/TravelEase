"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { cmsDefinition, type CmsDocument } from '@/lib/cms';
import { cmsSectionAnchor, type CmsOptions } from '@/lib/cms-catalogue';
interface Controls { options: CmsOptions | null; error: string; reload: () => void; anchors: { href: string; label: string }[] }
const Context = createContext<Controls>({ options: null, error: '', reload: () => {}, anchors: [] });
export const useCmsControls = () => useContext(Context);
export default function CmsControlsProvider({ document, children }: { document: CmsDocument; children: React.ReactNode }) {
  const [options, setOptions] = useState<CmsOptions | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/admin/cms/options', { cache: 'no-store', signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error || 'Could not load choices.'); if (!controller.signal.aborted) setOptions(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [attempt]);
  const anchors = document.sections.filter(s => s.visible).map(s => ({ href: cmsSectionAnchor(s), label: String(s.content.title || cmsDefinition(s.type).label) }));
  return <Context.Provider value={{ options, error, reload: () => setAttempt(n => n + 1), anchors }}>{children}</Context.Provider>;
}
