import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), verifyTransport: vi.fn(), sendApprovalEmail: vi.fn() }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath } from '../utils/fileStorage';
import { exchangeSendSchema, isLegacyVideoUrl } from '../domain/document-exchange';
import type { Prisma } from '@prisma/client';

const app = createApp();
const prefix = `exchange-test-${crypto.randomUUID()}`;
const base = '/api/v1/members/me/document-exchange';
const docs = '/api/v1/members/me/documents';
type Actor = { id: string; token: string; email: string };
let member: Actor, other: Actor, admin: Actor, inactive: Actor, newcomer: Actor;
const users: string[] = [], threads: string[] = [], announcements: string[] = [];
const files: { id: string; storageKey: string }[] = [];
let threadId: string, fileId: string;
const call = (actor: Actor, method: 'get' | 'post', url: string) => request(app)[method](url).set('Authorization', `Bearer ${actor.token}`);
const send = (actor: Actor, input: Record<string, unknown>) => call(actor, 'post', `${base}/items`).send({ clientRequestId: crypto.randomUUID(), ...input });
async function actor(name: string, role: 'MEMBER' | 'ADMIN', active = true) {
  const user = await prisma.user.create({ data: { fullName: `${prefix} ${name}`, email: `${prefix}.${name}@example.test`, role, status: active ? 'ACTIVE' : 'SUSPENDED' } });
  users.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  return { id: user.id, email: user.email, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function upload(owner: Actor, name = 'research.txt', content = 'Research document contents', mime = 'text/plain') {
  const response = await call(owner, 'post', '/api/v1/files/upload').attach('file', Buffer.from(content), { filename: name, contentType: mime });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  const file = await prisma.fileObject.findUniqueOrThrow({ where: { id: response.body.data.id } });
  files.push(file); return file.id;
}
async function messageFile(sender: Actor, fileId: string, conversationId = threadId, internal = false) {
  return prisma.message.create({ data: { conversationId, senderId: sender.id, senderName: sender.id, senderRole: sender.id === admin.id ? 'ADMIN' : 'MEMBER', body: 'Attachment fixture', internal, attachments: { create: { fileId } } }, include: { attachments: true } });
}
beforeAll(async () => {
  member = await actor('member', 'MEMBER'); other = await actor('other', 'MEMBER'); admin = await actor('admin', 'ADMIN');
  inactive = await actor('inactive', 'MEMBER', false); newcomer = await actor('new', 'MEMBER');
});
afterAll(async () => {
  const canonical = await prisma.documentExchange.findMany({ where: { memberId: { in: users } } });
  const allThreads = [...threads, ...canonical.map(e => e.conversationId)];
  await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: users } }, ...allThreads.map(id => ({ link: { endsWith: `/${id}` } }))] } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await prisma.conversation.deleteMany({ where: { id: { in: allThreads } } });
  await prisma.announcement.deleteMany({ where: { id: { in: announcements } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  for (const file of files) await fs.unlink(assertSafePath(file.storageKey)).catch(() => undefined);
  await prisma.$disconnect();
});

describe('exchange persistence and authorization', () => {
  it('does not create threads on read and requires active authentication', async () => {
    const summary = await call(member, 'get', base);
    expect(summary.status).toBe(200); expect(summary.body.data.conversationId).toBeNull();
    expect(summary.body.data.counts.documents).toBe(0); expect(summary.body.data.upload.maxFiles).toBe(5);
    for (const url of [base, docs, `${base}/items?type=messages`]) {
      expect((await request(app).get(url)).status).toBe(401);
      expect((await call(inactive, 'get', url)).status).toBe(401);
    }
    expect((await send(inactive, { type: 'message', body: 'Blocked' })).status).toBe(401);
    expect(await prisma.documentExchange.count({ where: { memberId: member.id } })).toBe(0);
  });
  it('creates a single canonical conversation on concurrent first sends with atomic notifications', async () => {
    const results = await Promise.all([1, 2, 3].map(i => send(member, { type: 'message', body: `Concurrent message ${i}` })));
    results.forEach(res => expect(res.status, JSON.stringify(res.body)).toBe(201));
    threadId = results[0]!.body.data.conversationId;
    expect(new Set(results.map(res => res.body.data.conversationId)).size).toBe(1);
    expect(await prisma.message.count({ where: { conversationId: threadId } })).toBe(3);
    expect(await prisma.notification.count({ where: { userId: admin.id, link: `/admin/messages/${threadId}` } })).toBe(3);
    expect((await call(other, 'get', `/api/v1/members/me/conversations/${threadId}`)).status).toBe(404);
    expect((await call(other, 'post', `/api/v1/members/me/conversations/${threadId}/messages`).send({ body: 'Forged reply' })).status).toBe(404);
  });
  it('returns a retryable error without partial writes when the CRO recipient lookup is empty', async () => {
    const transaction = prisma.$transaction.bind(prisma);
    const intercept = vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => transaction(async tx => {
      const recipients = vi.spyOn(tx.user, 'findMany').mockResolvedValueOnce([]);
      try { return await operation(tx); } finally { recipients.mockRestore(); }
    })) as typeof prisma.$transaction);
    try {
      const response = await send(newcomer, { type: 'message', body: 'No CRO recipient fixture' });
      expect(response.status).toBe(503); expect(response.body.meta.retryable).toBe(true);
      expect(await prisma.documentExchange.count({ where: { memberId: newcomer.id } })).toBe(0);
      expect(await prisma.message.count({ where: { senderId: newcomer.id } })).toBe(0);
    } finally { intercept.mockRestore(); }
  });
  it('uploads, shares and persists documents and makes duplicate retries idempotent', async () => {
    fileId = await upload(member);
    const clientRequestId = crypto.randomUUID();
    const results = await Promise.all([1, 2].map(() => send(member, { type: 'document', fileIds: [fileId], note: 'Study draft', clientRequestId })));
    results.forEach(res => expect(res.status, JSON.stringify(res.body)).toBe(201));
    expect(results[0]!.body.data.messageId).toBe(results[1]!.body.data.messageId);
    expect(await prisma.message.count({ where: { senderId: member.id, clientRequestId } })).toBe(1);
    const list = await call(member, 'get', docs);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0]).toMatchObject({ id: fileId, conversationId: threadId, direction: 'outgoing', opened: false, note: 'Study draft' });
    expect(list.body.data.items[0].attachmentId).not.toBe(fileId);
    expect(JSON.stringify(list.body)).not.toContain('storageKey');
    expect((await call(member, 'get', base)).body.data.counts.documents).toBe(1);
    expect((await call(admin, 'get', `/api/v1/admin/conversations/${threadId}`)).body.data.messages.at(-1).attachments[0].attachmentId).toBe(list.body.data.items[0].attachmentId);
  });
  it('rejects foreign, public, deleted, missing, oversized and spoofed files without creating threads', async () => {
    expect((await send(newcomer, { type: 'document', fileIds: [fileId] })).status).toBe(404);
    const own = await upload(newcomer);
    await prisma.fileObject.update({ where: { id: own }, data: { visibility: 'PUBLIC' } });
    expect((await send(newcomer, { type: 'document', fileIds: [own] })).status).toBe(404);
    await prisma.fileObject.update({ where: { id: own }, data: { visibility: 'PRIVATE', deletedAt: new Date() } });
    expect((await send(newcomer, { type: 'document', fileIds: [own] })).status).toBe(404);
    await prisma.fileObject.update({ where: { id: own }, data: { deletedAt: null, sizeBytes: 100000000 } });
    expect((await send(newcomer, { type: 'document', fileIds: [own] })).status).toBe(422);
    await prisma.fileObject.update({ where: { id: own }, data: { sizeBytes: 26 } });
    await fs.unlink(assertSafePath(files.find(f => f.id === own)!.storageKey));
    expect((await send(newcomer, { type: 'document', fileIds: [own] })).status).toBe(404);
    expect((await send(newcomer, { type: 'document', fileIds: [] })).status).toBe(422);
    expect((await send(member, { type: 'document', fileIds: [fileId, fileId] })).status).toBe(422);
    expect((await send(member, { type: 'document', fileIds: Array(6).fill(fileId) })).status).toBe(422);
    const spoof = await call(newcomer, 'post', '/api/v1/files/upload').attach('file', Buffer.from('Not a PDF'), { filename: 'spoof.pdf', contentType: 'application/pdf' });
    expect(spoof.status).toBe(422);
    const disguised = await upload(newcomer, 'binary.txt', '%PDF-1.4\n%%EOF');
    expect((await send(newcomer, { type: 'document', fileIds: [disguised] })).status).toBe(422);
    expect(await prisma.documentExchange.count({ where: { memberId: newcomer.id } })).toBe(0);
  });
});

describe('opening receipts and filtered pagination', () => {
  it('tracks each repeated sharing separately, ignores sender access and rejects forged contexts', async () => {
    await send(member, { type: 'document', fileIds: [fileId], note: 'Second exchange' });
    const list = (await call(member, 'get', docs)).body.data.items;
    const first = list[0], second = list[1];
    expect(first.id).toBe(second.id); expect(first.attachmentId).not.toBe(second.attachmentId);
    const download = `/api/v1/files/${fileId}/download`;
    expect((await call(other, 'get', download).query({ attachmentId: first.attachmentId })).status).toBe(404);
    expect((await call(member, 'get', download).query({ attachmentId: 'missing' })).status).toBe(404);
    expect((await call(member, 'get', download).query({ attachmentId: first.attachmentId })).status).toBe(200);
    expect(await prisma.attachmentOpen.count({ where: { attachmentId: first.attachmentId } })).toBe(0);
    expect((await request(app).head(download).set('Authorization', `Bearer ${admin.token}`).query({ attachmentId: first.attachmentId })).status).toBe(200);
    expect(await prisma.attachmentOpen.count({ where: { attachmentId: first.attachmentId } })).toBe(0);
    expect((await call(admin, 'get', download).query({ attachmentId: first.attachmentId, action: 'preview' })).status).toBe(200);
    await expect.poll(() => prisma.attachmentOpen.count({ where: { attachmentId: first.attachmentId } })).toBe(1);
    const receipt = await prisma.attachmentOpen.findFirstOrThrow({ where: { attachmentId: first.attachmentId } });
    await call(admin, 'get', download).query({ attachmentId: first.attachmentId, action: 'download' });
    expect(await prisma.attachmentOpen.findFirst({ where: { attachmentId: first.attachmentId } })).toMatchObject({ action: 'preview', openedAt: receipt.openedAt });
    const opened = await call(member, 'get', docs).query({ opened: 'opened', direction: 'outgoing' });
    expect(opened.body.data.items.map((r: { attachmentId: string }) => r.attachmentId)).toEqual([first.attachmentId]);
  });
  it('counts incoming new documents until access, excludes internal/direct/deleted files', async () => {
    const received = await upload(admin, 'cro-response.txt');
    const message = await messageFile(admin, received);
    const internalFile = await upload(admin, 'internal.txt');
    const internal = await messageFile(admin, internalFile, threadId, true);
    const direct = await prisma.conversation.create({ data: { subject: 'Direct fixture', category: 'Direct', kind: 'DIRECT', participants: { create: [{ userId: member.id }, { userId: other.id }] } } });
    threads.push(direct.id); await messageFile(other, received, direct.id);
    const deleted = await upload(admin, 'deleted.txt'); await messageFile(admin, deleted);
    await prisma.fileObject.update({ where: { id: deleted }, data: { deletedAt: new Date() } });
    const before = (await call(member, 'get', base)).body.data;
    expect(before.unreadDocuments).toBe(1); expect(before.counts.documents).toBe(3);
    expect((await call(member, 'get', docs)).body.data.items.map((r: { id: string }) => r.id)).not.toEqual(expect.arrayContaining([internalFile, deleted]));
    expect((await call(member, 'get', `/api/v1/files/${internalFile}/download`).query({ attachmentId: internal.attachments[0]!.id })).status).toBe(404);
    const item = message.attachments[0]!;
    expect((await call(member, 'get', `/api/v1/files/${received}/download`).query({ attachmentId: item.id, action: 'preview' })).status).toBe(200);
    await expect.poll(async () => (await call(member, 'get', base)).body.data.unreadDocuments).toBe(0);
    expect((await call(member, 'get', docs).query({ direction: 'incoming', opened: 'opened' })).body.data.pagination.total).toBe(1);
    await fs.unlink(assertSafePath(files.find(f => f.id === received)!.storageKey));
    expect((await call(admin, 'get', `/api/v1/files/${received}/download`).query({ attachmentId: item.id })).status).toBe(404);
    expect(await prisma.attachmentOpen.count({ where: { attachmentId: item.id } })).toBe(1);
  });
  it('searches and filters before counting; pages beyond 100 without duplicate attachments', async () => {
    const message = await prisma.message.create({ data: { conversationId: threadId, senderId: member.id, senderName: 'Member', senderRole: 'MEMBER', body: 'Pagination documents', attachments: { create: Array.from({ length: 111 }, () => ({ fileId })) } } });
    expect(message.id).toBeTruthy();
    const query = { q: 'Pagination documents', type: 'FILE', direction: 'outgoing', opened: 'unopened', limit: 50 };
    const pages = [];
    for (const page of [1, 2, 3]) pages.push((await call(member, 'get', docs).query({ ...query, page })).body.data);
    expect(pages.map(p => p.items.length)).toEqual([50, 50, 11]);
    expect(pages[0].pagination).toMatchObject({ total: 111, pages: 3 });
    expect(new Set(pages.flatMap(p => p.items.map((item: { attachmentId: string }) => item.attachmentId))).size).toBe(111);
    expect((await call(member, 'get', docs).query({ ...query, type: 'PDF' })).body.data.pagination.total).toBe(0);
    expect((await call(member, 'get', docs).query({ q: 'no-such-document' })).body.data.pagination.total).toBe(0);
    for (const invalid of [{ page: 0 }, { limit: 101 }, { type: 'EXE' }, { opened: 'yes' }, { direction: 'everyone' }]) expect((await call(member, 'get', docs).query(invalid)).status).toBe(422);
  });
});

describe('messages, video, meetings and announcements', () => {
  it('preserves existing replies, read status, CRO visibility and safe video links', async () => {
    const url = `/api/v1/admin/conversations/${threadId}/messages`;
    expect((await call(admin, 'post', url).send({ body: 'CRO reply', links: [{ url: 'https://vimeo.com/456', label: 'CRO video' }, { url: 'https://example.test/paper' }] })).status).toBe(200);
    const croVideos = await call(member, 'get', `${base}/items`).query({ type: 'videos' });
    expect(croVideos.body.data.items).toHaveLength(1); expect(croVideos.body.data.items[0].label).toBe('CRO video');
    const list = await call(member, 'get', `${base}/items`).query({ type: 'messages' });
    expect(list.body.data.pagination.total).toBe(1); expect(list.body.data.items[0].unreadCount).toBeGreaterThan(0);
    await call(member, 'post', `/api/v1/members/me/conversations/${threadId}/read`);
    expect((await call(member, 'get', `${base}/items`).query({ type: 'messages' })).body.data.items[0].unreadCount).toBe(0);
    expect((await call(member, 'post', `/api/v1/members/me/conversations/${threadId}/messages`).send({ body: 'Member reply' })).status).toBe(200);
    for (const url of ['javascript:alert(1)', 'file:///tmp/file', 'http://', 'https://user:password@example.test']) expect((await send(member, { type: 'video', url })).status).toBe(422);
    expect((await send(member, { type: 'video', url: 'https://www.youtube.com/watch?v=example' })).status).toBe(201);
    const videoList = await call(member, 'get', `${base}/items`).query({ type: 'videos' });
    expect(videoList.body.data.items[0]).toMatchObject({ conversationId: threadId, direction: 'outgoing', url: 'https://www.youtube.com/watch?v=example' });
    expect(isLegacyVideoUrl('https://vimeo.com/123')).toBe(true); expect(isLegacyVideoUrl('https://example.test/paper.pdf')).toBe(false);
  });
  it('validates future, real, unambiguous local meeting times and stores UTC plus timezone', async () => {
    const valid = { type: 'meeting', subject: 'Research consultation', dateTime: '2035-06-10T09:00', timezone: 'Asia/Kolkata' };
    for (const bad of [{ subject: ' ' }, { timezone: 'Not/AZone' }, { dateTime: '2000-01-01T10:00' }, { dateTime: '2035-02-30T09:00' }, { timezone: 'America/New_York', dateTime: '2035-03-11T02:30' }, { timezone: 'America/New_York', dateTime: '2035-11-04T01:30' }]) {
      expect(exchangeSendSchema.safeParse({ ...valid, ...bad, clientRequestId: crypto.randomUUID() }).success).toBe(false);
      expect((await send(member, { ...valid, ...bad })).status).toBe(422);
    }
    const response = await send(member, valid); expect(response.status).toBe(201);
    const message = await prisma.message.findUniqueOrThrow({ where: { id: response.body.data.messageId } });
    expect(message.meetingRequestedAt?.toISOString()).toBe('2035-06-10T03:30:00.000Z'); expect(message.meetingTimezone).toBe('Asia/Kolkata'); expect(message.body).toBe(valid.subject);
    const detail = await call(member, 'get', `/api/v1/members/me/conversations/${threadId}`);
    expect(detail.body.data.messages.at(-1).meetingRequestedAt).toBe('2035-06-10T03:30:00.000Z');
    expect(JSON.stringify(detail.body)).not.toContain('internal.txt');
  });
  it('restricts announcements to sent, published and member-eligible audiences', async () => {
    const now = new Date(Date.now() - 1000);
    for (const [name, audience, status, sentAt, recipient] of [
      ['all', 'All Members', 'SENT', now, null], ['members', 'Members Only', 'SENT', now, null],
      ['targeted', 'Unknown group', 'SENT', now, member.id], ['email-targeted', 'Unknown', 'SENT', now, member.email],
      ['private', 'Unknown group', 'SENT', now, other.id], ['unknown', 'Unknown group', 'SENT', now, null],
      ['draft', 'All Members', 'DRAFT', now, null], ['future', 'All Members', 'SENT', new Date(Date.now() + 3600000), null],
    ] as const) {
      const row = await prisma.announcement.create({ data: { authorId: admin.id, subject: `${prefix} ${name}`, body: 'Announcement body', audience, channel: 'Email', status, sentAt,
        ...(recipient ? { deliveries: { create: recipient.includes('@') ? { recipientEmail: recipient } : { recipientUserId: recipient } } } : {}) } }); announcements.push(row.id);
    }
    const response = await call(member, 'get', `${base}/items`).query({ type: 'announcements', limit: 100 });
    const ours = response.body.data.items.filter((a: { id: string }) => announcements.includes(a.id));
    expect(ours.map((a: { subject: string }) => a.subject.replace(`${prefix} `, '')).sort()).toEqual(['all', 'email-targeted', 'members', 'targeted']);
    expect((await call(member, 'get', `${base}/items`).query({ type: 'unknown' })).status).toBe(422);
  });
});
