import { CommunityImage } from './CommunityMedia';
import { Users } from 'lucide-react';

export default function CommunityAvatar({ name, src, className = '' }: { name: string; src?: string; className?: string }) {
  return <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-forum-100 text-forum-700 ${className}`}>
    {src ? <CommunityImage src={src} alt="" className="h-full w-full object-cover" /> : name ? <span className="text-sm font-semibold">{name.slice(0, 2).toUpperCase()}</span> : <Users className="h-5 w-5" />}
  </div>;
}
