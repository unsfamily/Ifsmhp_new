import { useEffect, useId, useRef, useState } from 'react';
import { RefreshCw, Upload } from 'lucide-react';
import Button from '../../components/common/Button';
import { memberApi, type MemberProfileData } from '../../api/member';
import { normalizeError } from '../../api/client';

export default function MemberProfileImage({ profile, initials, editable, onSaved }: {
  profile: MemberProfileData | null;
  initials: string;
  editable: boolean;
  onSaved: (avatarFileId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null), guidanceId = useId();
  const alive = useRef(true), selection = useRef(0), busy = useRef(false);
  const upload = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState<{ file: File; url: string } | null>(null);
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const [checking, setChecking] = useState(false), [saving, setSaving] = useState(false);
  const [imageLoading, setImageLoading] = useState(false), [imageError, setImageError] = useState('');
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [retry, setRetry] = useState(0);
  const avatarFileId = profile?.avatarFileId;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; upload.current?.abort(); };
  }, []);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.url); }, [draft]);
  useEffect(() => {
    setImage(null); setImageError(''); setImageLoading(false);
    if (!avatarFileId || !editable) return;
    const controller = new AbortController();
    let url = '';
    setImageLoading(true);
    memberApi.avatar(controller.signal).then(async blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      const decoded = new Image(); decoded.src = url; await decoded.decode();
      if (!controller.signal.aborted) setImage({ id: avatarFileId, url });
    }).catch(() => {
      if (!controller.signal.aborted) setImageError('Unable to load your profile image.');
    }).finally(() => { if (!controller.signal.aborted) setImageLoading(false); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [avatarFileId, editable, retry]);

  const choose = async (file: File) => {
    if (!profile || busy.current) return;
    const version = ++selection.current;
    setDraft(null); setError(''); setSuccess(''); setChecking(false);
    const policy = profile.avatarPolicy;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const expected: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    if (!policy.extensions.includes(extension) || !policy.mimeTypes.includes(file.type) || expected[extension] !== file.type) {
      setError('Choose a JPEG, PNG, or WebP image.'); return;
    }
    if (!file.size || file.size > policy.maxBytes) {
      setError(`Choose a non-empty image up to ${policy.maxBytes / 1024 / 1024} MB.`); return;
    }
    setChecking(true);
    const url = URL.createObjectURL(file);
    try {
      const decoded = new Image(); decoded.src = url; await decoded.decode();
      if (!alive.current || selection.current !== version) { URL.revokeObjectURL(url); return; }
      setDraft({ file, url });
    } catch {
      URL.revokeObjectURL(url);
      if (alive.current && selection.current === version) setError('This image could not be opened. Choose a valid JPEG, PNG, or WebP image.');
    } finally { if (alive.current && selection.current === version) setChecking(false); }
  };

  const save = async () => {
    if (!draft || busy.current || !editable) return;
    busy.current = true; setSaving(true); setError(''); setSuccess('');
    const controller = new AbortController(); upload.current = controller;
    try {
      const result = await memberApi.uploadAvatar(draft.file, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      onSaved(result.avatarFileId); setDraft(null);
      setSuccess('Profile image saved successfully.');
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(normalizeError(failure).message);
    } finally {
      if (alive.current && !controller.signal.aborted) { busy.current = false; setSaving(false); }
    }
  };
  const savedUrl = image && image.id === avatarFileId ? image.url : '';

  return <div className="w-full shrink-0 space-y-3 lg:w-56">
    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-forum-100 ring-4 ring-brass-500/20 text-forum-700">
      {savedUrl ? <img src={savedUrl} alt="Your profile image" className="h-full w-full object-cover" onError={() => { setImage(null); setImageError('Unable to load your profile image.'); }} />
        : <span className="font-display text-3xl font-bold">{initials}</span>}
    </div>
    {imageLoading && <p role="status" className="text-sm text-ink-muted">Loading profile image...</p>}
    {imageError && <div role="alert" className="text-sm text-danger-600">{imageError}
      <Button variant="ghost" size="sm" onClick={() => setRetry(v => v + 1)}><RefreshCw className="h-4 w-4" />Retry image</Button>
    </div>}
    {editable && <>
      <input ref={input} type="file" className="sr-only" aria-label="Profile image file" aria-describedby={guidanceId}
        accept={profile?.avatarPolicy.mimeTypes.join(',')} disabled={!profile || saving}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void choose(file); }} />
      <Button variant="outline" size="sm" disabled={!profile || saving} onClick={() => input.current?.click()}>
        <Upload className="h-4 w-4 shrink-0" />{avatarFileId ? 'Change Profile Image' : 'Upload Profile Image'}
      </Button>
      {profile && <p id={guidanceId} className="text-xs text-ink-muted">JPEG, PNG, or WebP. Maximum {profile.avatarPolicy.maxBytes / 1024 / 1024} MB.</p>}
      {checking && <p role="status" className="text-sm text-ink-muted">Checking image...</p>}
      {draft && <div className="space-y-2 rounded-lg border border-paper-border bg-paper p-3">
        <p className="text-sm font-medium text-forum-900">Unsaved image preview</p>
        <img src={draft.url} alt="Selected profile image preview" className="h-28 w-28 rounded-full object-cover" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => void save()}>{saving && <RefreshCw className="h-4 w-4 animate-spin" />}{saving ? 'Uploading...' : 'Save Image'}</Button>
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => { selection.current++; setDraft(null); setError(''); }}>Cancel</Button>
        </div>
        {saving && <p role="status" className="text-sm text-ink-muted">Uploading profile image...</p>}
      </div>}
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      {success && <p role="status" className="text-sm text-forum-700">{success}</p>}
    </>}
  </div>;
}
