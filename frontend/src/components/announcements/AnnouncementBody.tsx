import { renderAnnouncement } from '../../../../backend/domain/announcement-markdown';
export default function AnnouncementBody({ body }: { body: string }) {
  return <div className="prose prose-sm max-w-none break-words text-ink [overflow-wrap:anywhere] [&_a]:text-forum-700 [&_a]:underline [&_pre]:whitespace-pre-wrap [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: renderAnnouncement(body) }} />;
}
