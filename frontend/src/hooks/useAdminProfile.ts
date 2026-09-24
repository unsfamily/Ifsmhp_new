import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeError } from '../api/client';
import { adminProfileService as api, type AdminProfileData, type AdminProfileFields, type AdminPreferences, type AdminOverview } from '../services/adminProfileService';
export const emptyProfile: AdminProfileFields = { firstName: '', lastName: '', displayName: '', designation: '', jobTitle: '', workEmail: '', phone: '', institution: '', country: '', timezone: 'UTC', orcid: '', website: '', bio: '' };
export function useAdminProfile() {
  const { user, refreshUser } = useAuth();
  const identity = `${user?.id}:${user?.role}:${user?.status}`;
  const current = useRef(identity); current.current = identity;
  const controller = useRef<AbortController | null>(null), generation = useRef(0), overviewGeneration = useRef(0), busyRef = useRef(false);
  const [data, setData] = useState<AdminProfileData | null>(null), [profile, setProfile] = useState(emptyProfile), [preferences, setPreferences] = useState<AdminPreferences>({ appNewMember: false, supportUrgent: false, supportAll: false, inquiryNew: false });
  const [overview, setOverview] = useState<AdminOverview | null>(null), [overviewError, setOverviewError] = useState(''), [error, setError] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [success, setSuccess] = useState(''), [conflict, setConflict] = useState(false), [reviewRequired, setReviewRequired] = useState(false), [denied, setDenied] = useState(false), [avatarUrl, setAvatarUrl] = useState('');
  const [loadedIdentity, setLoadedIdentity] = useState(identity);
  const fail = useCallback((failure: unknown) => {
    const problem = normalizeError(failure);
    if ([401, 403].includes(problem.status ?? 0)) { controller.current?.abort(); generation.current++; overviewGeneration.current++; setDenied(true); setData(null); setOverview(null); setProfile(emptyProfile); setPreferences({ appNewMember: false, supportUrgent: false, supportAll: false, inquiryNew: false }); setAvatarUrl(''); }
    setError(problem.message); setFields(problem.fieldErrors); if (problem.status === 409) setConflict(true);
    return problem;
  }, []);
  const refreshOverview = useCallback(async () => {
    const version = ++overviewGeneration.current;
    try { const next = await api.overview(controller.current?.signal); if (current.current === identity && version === overviewGeneration.current) { setOverview(next); setOverviewError(''); } }
    catch (e) { if (current.current === identity && version === overviewGeneration.current && !controller.current?.signal.aborted) { const p = normalizeError(e); if ([401, 403].includes(p.status ?? 0)) fail(e); else setOverviewError(p.message); } }
  }, [identity, fail]);
  const load = useCallback(async (preserveDraft = false) => {
    controller.current?.abort(); controller.current = new AbortController(); const version = ++generation.current; setLoading(true); setError('');
    try { const next = await api.get(controller.current.signal); if (current.current !== identity || generation.current !== version) return; setData(next); setLoadedIdentity(identity); setDenied(false); if (!preserveDraft) { setProfile(next.profile); setPreferences(next.preferences); } setConflict(preserveDraft); setReviewRequired(preserveDraft); void refreshOverview(); }
    catch (e) { if (current.current === identity && generation.current === version && !controller.current?.signal.aborted) fail(e); }
    finally { if (current.current === identity && generation.current === version) setLoading(false); }
  }, [identity, fail, refreshOverview]);
  useEffect(() => { setData(null); setOverview(null); setProfile(emptyProfile); setAvatarUrl(''); setDenied(false); setSuccess(''); setConflict(false); busyRef.current = false; setBusy(''); void load(); return () => { controller.current?.abort(); }; }, [load]);
  useEffect(() => { const refresh = () => { if (!document.hidden && !busyRef.current && !denied) void refreshOverview(); }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, [refreshOverview, denied]);
  useEffect(() => {
    setAvatarUrl(''); if (!data?.avatarFileId || denied) return;
    const request = new AbortController(); let url = '';
    api.image(request.signal).then(blob => { if (!request.signal.aborted) { url = URL.createObjectURL(blob); setAvatarUrl(url); } }).catch(e => { if (!request.signal.aborted) fail(e); });
    return () => { request.abort(); if (url) URL.revokeObjectURL(url); };
  }, [data?.avatarFileId, identity, denied, fail]);
  const mutate = async (kind: string, work: (signal: AbortSignal) => Promise<AdminProfileData | void>) => {
    if (busyRef.current || denied || conflict || !data) return false;
    busyRef.current = true; setBusy(kind); setError(''); setFields({}); setSuccess(''); overviewGeneration.current++;
    const captured = identity, request = controller.current!;
    try { const next = await work(request.signal); if (current.current !== captured || request.signal.aborted) return false; if (next) { setData(next); if (kind === 'profile' || kind === 'all') setProfile(next.profile); if (kind === 'preferences' || kind === 'all') setPreferences(next.preferences); } setSuccess(kind === 'password' ? 'Password updated. Other sessions have been signed out.' : kind === 'avatar' ? 'Avatar updated.' : 'Changes saved.'); void refreshOverview(); if (kind === 'profile' || kind === 'all') await refreshUser(); return true; }
    catch (e) { if (current.current === captured && !request.signal.aborted) fail(e); return false; }
    finally { if (current.current === captured) { busyRef.current = false; setBusy(''); } }
  };
  const save = (kind: 'profile' | 'preferences' | 'all') => mutate(kind, signal => api.save({ expectedRevision: data!.revision, ...(kind !== 'preferences' ? { profile } : {}), ...(kind !== 'profile' ? { preferences } : {}) }, signal));
  const upload = (file: File) => mutate('avatar', signal => api.avatar(file, data!.revision, signal));
  const password = (currentPassword: string, password: string, confirmation: string) => mutate('password', signal => api.password({ currentPassword, password, confirmation }, signal));
  return { data: loadedIdentity === identity ? data : null, profile, preferences, setProfile, setPreferences, overview, overviewError, loading, busy, success, error, fields, denied, conflict, reviewRequired, confirmReview: () => { setConflict(false); setReviewRequired(false); }, avatarUrl, load, save, upload, password, refreshOverview, fail };
}
