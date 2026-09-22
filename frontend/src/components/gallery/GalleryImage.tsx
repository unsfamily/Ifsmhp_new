import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function GalleryImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const { user } = useAuth(); const protectedSource = src?.startsWith('/admin/gallery/');
  const [resolved, setResolved] = useState<{ source: string; owner?: string; url: string } | null>(null);
  useEffect(() => {
    if (!src || !protectedSource || user?.role !== 'ADMIN') return;
    const controller = new AbortController(); let url: string | undefined;
    apiClient.get<Blob>(src, { responseType: 'blob', signal: controller.signal }).then(response => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(response.data); setResolved({ source: src, owner: user.id, url });
    }).catch(() => { if (!controller.signal.aborted) setResolved(null); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [src, protectedSource, user?.id, user?.role]);
  const source = protectedSource ? resolved && resolved.source === src && resolved.owner === user?.id && user?.role === 'ADMIN' ? resolved.url : undefined : src?.startsWith('/public/gallery/') ? `${apiClient.defaults.baseURL}${src}` : src;
  return <img {...props} src={source || undefined} />;
}
