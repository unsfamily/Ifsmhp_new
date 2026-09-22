import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { apiClient, normalizeError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { MessageAttachment } from '../../types/community';

export function CommunityImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { user } = useAuth();
  const [resolved, setResolved] = useState<{ source: string; userId?: string; url: string } | null>(null);
  const protectedSource = src?.startsWith('/files/');
  useEffect(() => {
    if (!src || !protectedSource) return;
    let alive = true; let url: string | undefined;
    const controller = new AbortController();
    apiClient.get<Blob>(src, { responseType: 'blob', signal: controller.signal }).then(response => {
      if (!alive) return;
      url = URL.createObjectURL(response.data); setResolved({ source: src, userId: user?.id, url });
    }).catch(() => { if (alive) setResolved(null); });
    return () => { alive = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [src, protectedSource, user?.id]);
  return <img {...props} src={protectedSource ? resolved?.source === src && resolved?.userId === user?.id ? resolved?.url : undefined : src} />;
}
export function CommunityAttachmentLink({ file, className }: { file: MessageAttachment; className: string }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const open = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await apiClient.get<Blob>(file.fileUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.fileName; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(normalizeError(failure).message); } finally { setBusy(false); }
  };
  return <><a href={file.fileUrl} aria-disabled={busy} onClick={event => { event.preventDefault(); void open(); }} className={className}>{file.fileName}</a>{error && <span role="alert" className="block text-xs text-danger-600">{error}</span>}</>;
}
