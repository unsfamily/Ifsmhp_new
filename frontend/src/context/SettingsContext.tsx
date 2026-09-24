import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { settingsService, type PublicSettings } from '../services/settingsService';
const Context = createContext<PublicSettings | null>(null);
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<PublicSettings | null>(null), request = useRef<AbortController | null>(null);
  const refresh = useCallback(() => { request.current?.abort(); const r = new AbortController(); request.current = r; settingsService.public(r.signal).then(v => { if (!r.signal.aborted) setValue(v); }).catch(() => { /* Keep last published configuration on transient failures. */ }); }, []);
  useEffect(() => { refresh(); const visible = () => { if (!document.hidden) refresh(); }; window.addEventListener('settings-changed', refresh); window.addEventListener('focus', visible); const timer = window.setInterval(visible, 60000); return () => { request.current?.abort(); window.clearInterval(timer); window.removeEventListener('settings-changed', refresh); window.removeEventListener('focus', visible); }; }, [refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const usePublicSettings = () => useContext(Context);
export function formatConfiguredDate(date: string | Date, settings: PublicSettings | null, timezone?: string) {
  const d = new Date(date); if (Number.isNaN(+d)) return 'Unavailable';
  const timeZone = timezone ?? settings?.timezone ?? 'UTC';
  if (!settings || settings.dateFormat === 'long') return new Intl.DateTimeFormat(settings?.locale ?? 'en-GB', { timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const p = (type: string) => parts.find(v => v.type === type)?.value;
  return settings.dateFormat === 'YYYY-MM-DD' ? `${p('year')}-${p('month')}-${p('day')}` : settings.dateFormat === 'MM/DD/YYYY' ? `${p('month')}/${p('day')}/${p('year')}` : `${p('day')}/${p('month')}/${p('year')}`;
}
