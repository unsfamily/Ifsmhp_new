import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing in these tests should send mail; stubbed so the suite never touches SMTP.
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async () => undefined),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async () => undefined),
}));

import { createApp } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';

/**
 * Covers the conversation surface shared by the CRO inbox and the member's
 * "Messages from CRO" screen: thread access scoping, sending, unread counts and
 * read receipts. Fixtures are namespaced by this prefix and removed afterwards,
 * so seeded data is never touched.
 */
const app = createApp();
const PREFIX = 'messaging-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

let adminId: string;
let adminToken: string;
let memberId: string;
let memberToken: string;
let strangerId: string;
let strangerToken: string;

async function makeUser(key: string, role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({
    data: { email: email(key), passwordHash: null, fullName: `Messaging ${key}`, role, status: 'ACTIVE' },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}-${Math.random()}`),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}

/** A thread between the member and the admin, oldest message first. */
async function makeConversation(opts: {
  subject?: string;
  withAdmin?: boolean;
  messages?: { from: 'member' | 'admin'; body: string; internal?: boolean; minutesAgo?: number }[];
  memberLastReadAt?: Date | null;
} = {}) {
  const messages = opts.messages ?? [{ from: 'member' as const, body: 'Opening question' }];
  return prisma.conversation.create({
    data: {
      subject: opts.subject ?? `${PREFIX} thread`,
      category: 'Member Support',
      participants: {
        create: [
          { userId: memberId, roleLabel: 'Member', lastReadAt: opts.memberLastReadAt ?? null },
          ...(opts.withAdmin === false ? [] : [{ userId: adminId, roleLabel: 'CRO Office' }]),
        ],
      },
      messages: {
        create: messages.map((m) => ({
          senderId: m.from === 'member' ? memberId : adminId,
          senderName: m.from === 'member' ? 'Messaging member' : 'Messaging admin',
          senderRole: m.from === 'member' ? 'MEMBER' : 'ADMIN',
          body: m.body,
          internal: m.internal ?? false,
          ...(m.minutesAgo === undefined ? {} : { createdAt: new Date(Date.now() - m.minutesAgo * 60_000) }),
        })),
      },
    },
  });
}

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_STORAGE_PATH);
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/**
 * A stored upload owned by `userId`, standing in for POST /files/upload.
 * `onDisk` also writes the bytes, so a download can actually stream and a 404
 * therefore means the ACL refused rather than the file being absent.
 */
async function makeFile(userId: string, name = `${PREFIX}-doc.pdf`, onDisk = false) {
  const storageKey = `${PREFIX}-${crypto.randomUUID()}.pdf`;
  if (onDisk) {
    await fsp.mkdir(uploadRoot, { recursive: true });
    await fsp.writeFile(path.join(uploadRoot, storageKey), PDF_BYTES);
  }
  return prisma.fileObject.create({
    data: {
      uploaderId: userId,
      storageKey,
      originalName: name,
      mimeType: 'application/pdf',
      sizeBytes: onDisk ? PDF_BYTES.length : 2048,
    },
  });
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    // Conversations are not owned by a user, so they must go explicitly.
    await prisma.conversation.deleteMany({ where: { participants: { some: { userId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.conversation.deleteMany({ where: { subject: { contains: PREFIX } } });
  // FileObject.uploader is optional, so deleting the user only nulls the column.
  const stored = await prisma.fileObject.findMany({ where: { OR: [{ storageKey: { startsWith: `${PREFIX}-` } }, { originalName: { startsWith: `${PREFIX}-` } }] }, select: { id: true, storageKey: true } });
  if (stored.length) {
    await prisma.fileObject.deleteMany({ where: { id: { in: stored.map((f) => f.id) } } });
    await Promise.all(stored.map((f) => fsp.unlink(path.join(uploadRoot, f.storageKey)).catch(() => undefined)));
  }
}

beforeAll(async () => {
  await wipe();
});

beforeEach(async () => {
  await wipe();
  const admin = await makeUser('admin', 'ADMIN');
  const member = await makeUser('member', 'MEMBER');
  const stranger = await makeUser('stranger', 'MEMBER');
  adminId = admin.id;
  adminToken = admin.token;
  memberId = member.id;
  memberToken = member.token;
  strangerId = stranger.id;
  strangerToken = stranger.token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const asAdmin = (method: 'get' | 'post', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${adminToken}`);
const asMember = (method: 'get' | 'post', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${memberToken}`);
const asStranger = (method: 'get' | 'post', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${strangerToken}`);

describe('authentication and role boundaries', () => {
  it('rejects unauthenticated callers on every messaging route', async () => {
    const conversation = await makeConversation();
    const routes: [('get' | 'post'), string][] = [
      ['get', '/api/v1/admin/conversations'],
      ['get', `/api/v1/admin/conversations/${conversation.id}`],
      ['post', `/api/v1/admin/conversations/${conversation.id}/messages`],
      ['get', '/api/v1/members/me/conversations'],
      ['get', `/api/v1/members/me/conversations/${conversation.id}`],
      ['post', '/api/v1/members/me/conversations'],
      ['post', `/api/v1/members/me/conversations/${conversation.id}/messages`],
    ];
    for (const [method, url] of routes) {
      const res = await request(app)[method](url);
      expect(res.status, url).toBe(401);
    }
  });

  it('refuses a MEMBER on the admin inbox', async () => {
    const conversation = await makeConversation();
    expect((await asMember('get', '/api/v1/admin/conversations')).status).toBe(403);
    expect((await asMember('get', `/api/v1/admin/conversations/${conversation.id}`)).status).toBe(403);
    const res = await asMember('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({ body: 'let me in' });
    expect(res.status).toBe(403);
  });
});

describe('member thread access', () => {
  it('lists only conversations the member takes part in', async () => {
    await makeConversation({ subject: `${PREFIX} mine` });
    // A thread between the stranger and the admin.
    await prisma.conversation.create({
      data: {
        subject: `${PREFIX} theirs`,
        category: 'Member Support',
        participants: { create: [{ userId: strangerId }, { userId: adminId }] },
      },
    });

    const res = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    expect(res.status).toBe(200);
    const subjects = res.body.data.items.map((c: { subject: string }) => c.subject);
    expect(subjects).toContain(`${PREFIX} mine`);
    expect(subjects).not.toContain(`${PREFIX} theirs`);
  });

  it("404s another member's thread rather than 403", async () => {
    const conversation = await makeConversation();
    const res = await asStranger('get', `/api/v1/members/me/conversations/${conversation.id}`);
    expect(res.status).toBe(404);
  });

  it('refuses a post to a thread the member is not in, and writes nothing', async () => {
    const conversation = await makeConversation();
    const before = await prisma.message.count({ where: { conversationId: conversation.id } });

    const res = await asStranger('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({ body: 'sneaking in' });
    expect(res.status).toBe(404);
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(before);
  });

  it('hides internal CRO notes from the member', async () => {
    const conversation = await makeConversation({
      messages: [
        { from: 'member', body: 'Visible question' },
        { from: 'admin', body: 'Internal triage note', internal: true },
        { from: 'admin', body: 'Visible reply' },
      ],
    });

    const memberView = await asMember('get', `/api/v1/members/me/conversations/${conversation.id}`);
    expect(memberView.status).toBe(200);
    const bodies = memberView.body.data.messages.map((m: { text: string }) => m.text);
    expect(bodies).toEqual(['Visible question', 'Visible reply']);
    // The count must not betray the hidden note either.
    expect(memberView.body.data.totalMessages).toBe(2);

    const adminView = await asAdmin('get', `/api/v1/admin/conversations/${conversation.id}`);
    expect(adminView.body.data.messages).toHaveLength(3);
  });
});

describe('sending messages', () => {
  it('bumps the conversation so a reply lifts the thread to the top', async () => {
    const older = await makeConversation({ subject: `${PREFIX} older` });
    await prisma.conversation.update({ where: { id: older.id }, data: { updatedAt: new Date(Date.now() - 86_400_000) } });
    const newer = await makeConversation({ subject: `${PREFIX} newer` });
    await prisma.conversation.update({ where: { id: newer.id }, data: { updatedAt: new Date(Date.now() - 3_600_000) } });

    const res = await asMember('post', `/api/v1/members/me/conversations/${older.id}/messages`).send({ body: 'Bumping this thread' });
    expect(res.status).toBe(200);

    const stored = await prisma.conversation.findUnique({ where: { id: older.id } });
    expect(stored!.updatedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);

    const list = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    const ours = list.body.data.items.filter((c: { subject: string }) => c.subject.startsWith(PREFIX));
    expect(ours[0].subject).toBe(`${PREFIX} older`);
  });

  it('notifies the other participant but not the sender', async () => {
    const conversation = await makeConversation();
    await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({ body: 'Please advise' });

    expect(await prisma.notification.count({ where: { userId: adminId, type: 'message' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: memberId, type: 'message' } })).toBe(0);
  });

  it('lets an admin reply to a thread they were never a participant of', async () => {
    const conversation = await makeConversation({ withAdmin: false });
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conversation.id, userId: adminId } })).toBe(0);

    const res = await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({ body: 'CRO picking this up' });
    expect(res.status).toBe(200);

    // The reply adds them, so the thread now belongs to their inbox too.
    expect(await prisma.conversationParticipant.count({ where: { conversationId: conversation.id, userId: adminId } })).toBe(1);
    const stored = await prisma.message.findFirst({ where: { conversationId: conversation.id, senderId: adminId } });
    expect(stored?.senderRole).toBe('ADMIN');
  });

  it('records an admin internal note without notifying the member', async () => {
    const conversation = await makeConversation();
    const res = await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({ body: 'Internal only', internal: true });
    expect(res.status).toBe(200);

    const stored = await prisma.message.findFirst({ where: { conversationId: conversation.id, internal: true } });
    expect(stored?.body).toBe('Internal only');
    expect(await prisma.notification.count({ where: { userId: memberId, type: 'message' } })).toBe(0);
  });

  it('rejects an empty or oversized body', async () => {
    const conversation = await makeConversation();
    expect((await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({ body: '   ' })).status).toBe(422);
    expect((await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({ body: 'x'.repeat(10001) })).status).toBe(422);
  });
});

describe('unread counts and read receipts', () => {
  it('counts messages from others since lastReadAt, never your own', async () => {
    const conversation = await makeConversation({
      memberLastReadAt: new Date(Date.now() - 60 * 60_000),
      messages: [
        { from: 'admin', body: 'Old, already read', minutesAgo: 120 },
        { from: 'admin', body: 'New one', minutesAgo: 30 },
        { from: 'admin', body: 'New two', minutesAgo: 20 },
        { from: 'member', body: 'My own reply', minutesAgo: 10 },
      ],
    });

    const res = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    const row = res.body.data.items.find((c: { id: string }) => c.id === conversation.id);
    expect(row.unreadCount).toBe(2);
    // And the true message count, not the truncated preview array.
    expect(row.totalMessages).toBe(4);
  });

  it('treats a never-opened thread as fully unread', async () => {
    const conversation = await makeConversation({
      memberLastReadAt: null,
      messages: [{ from: 'admin', body: 'One' }, { from: 'admin', body: 'Two' }],
    });
    const res = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    expect(res.body.data.items.find((c: { id: string }) => c.id === conversation.id).unreadCount).toBe(2);
  });

  it('clears the count when the thread is marked read', async () => {
    const conversation = await makeConversation({
      memberLastReadAt: null,
      messages: [{ from: 'admin', body: 'Unread' }],
    });

    const marked = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/read`);
    expect(marked.status).toBe(200);

    const participant = await prisma.conversationParticipant.findFirst({ where: { conversationId: conversation.id, userId: memberId } });
    expect(participant?.lastReadAt).not.toBeNull();

    const res = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    expect(res.body.data.items.find((c: { id: string }) => c.id === conversation.id).unreadCount).toBe(0);
  });

  it('refuses to mark a thread read for a non-participant', async () => {
    const conversation = await makeConversation();
    expect((await asStranger('post', `/api/v1/members/me/conversations/${conversation.id}/read`)).status).toBe(404);
  });

  it('excludes internal notes from the member unread count', async () => {
    const conversation = await makeConversation({
      memberLastReadAt: null,
      messages: [{ from: 'admin', body: 'Internal', internal: true }],
    });
    const res = await asMember('get', '/api/v1/members/me/conversations?limit=100');
    expect(res.body.data.items.find((c: { id: string }) => c.id === conversation.id).unreadCount).toBe(0);
  });
});

describe('members starting a thread', () => {
  it('creates a conversation that includes an admin participant', async () => {
    const res = await asMember('post', '/api/v1/members/me/conversations').send({
      subject: `${PREFIX} new thread`,
      category: 'Member Support',
      body: 'I would like to ask about the symposium.',
    });
    expect(res.status).toBe(201);

    const created = await prisma.conversation.findUnique({
      where: { id: res.body.data.id },
      include: { participants: true, messages: true },
    });
    expect(created!.participants.map((p) => p.userId)).toContain(memberId);
    expect(created!.participants.some((p) => p.userId === adminId)).toBe(true);
    expect(created!.messages).toHaveLength(1);
    expect(created!.messages[0]!.senderRole).toBe('MEMBER');

    // It shows up in the CRO inbox straight away.
    const inbox = await asAdmin('get', '/api/v1/admin/conversations?limit=100');
    expect(inbox.body.data.items.some((c: { id: string }) => c.id === created!.id)).toBe(true);
  });

  it('validates the new-thread payload', async () => {
    expect((await asMember('post', '/api/v1/members/me/conversations').send({ subject: 'ab', category: 'X', body: '' })).status).toBe(422);
    expect((await asMember('post', '/api/v1/members/me/conversations').send({ subject: `${PREFIX} ok subject`, category: 'Member Support' })).status).toBe(422);
  });
});

describe('conversation analytics', () => {
  it('reports turnaround between the two sides', async () => {
    const conversation = await makeConversation({
      messages: [
        { from: 'member', body: 'Question', minutesAgo: 200 },
        { from: 'admin', body: 'Answer after 60m', minutesAgo: 140 },
        { from: 'member', body: 'Follow-up after 20m', minutesAgo: 120 },
        { from: 'admin', body: 'Second answer after 40m', minutesAgo: 80 },
      ],
    });

    const res = await asAdmin('get', `/api/v1/admin/conversations/${conversation.id}`);
    expect(res.status).toBe(200);
    const { analytics } = res.body.data;
    expect(analytics.firstResponseMinutes).toBeCloseTo(60, 0);
    // Role changes at 60m, 20m and 40m.
    expect(analytics.avgResponseMinutes).toBeCloseTo(40, 0);
    expect(analytics.responseCount).toBe(3);
    expect(analytics.participantCount).toBe(2);
  });

  it('returns nulls for a thread with no reply yet', async () => {
    const conversation = await makeConversation({ messages: [{ from: 'member', body: 'Only one' }] });
    const res = await asAdmin('get', `/api/v1/admin/conversations/${conversation.id}`);
    expect(res.body.data.analytics.avgResponseMinutes).toBeNull();
    expect(res.body.data.analytics.firstResponseMinutes).toBeNull();
  });
});

describe('attachments and shared links', () => {
  it('attaches an owned file and returns it on both detail routes', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(memberId, `${PREFIX}-protocol.pdf`);

    const res = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
      body: 'Protocol attached.',
      fileIds: [file.id],
      links: [{ url: 'https://example.test/briefing', label: 'Briefing video' }],
    });
    expect(res.status).toBe(200);

    expect(await prisma.messageAttachment.count({ where: { fileId: file.id } })).toBe(1);

    const memberView = await asMember('get', `/api/v1/members/me/conversations/${conversation.id}`);
    const latest = memberView.body.data.messages.at(-1);
    expect(latest.attachments).toHaveLength(1);
    expect(latest.attachments[0].name).toBe(`${PREFIX}-protocol.pdf`);
    expect(latest.attachments[0].size).toBe(2048);
    expect(latest.links).toHaveLength(1);
    expect(latest.links[0].label).toBe('Briefing video');

    const adminView = await asAdmin('get', `/api/v1/admin/conversations/${conversation.id}`);
    expect(adminView.body.data.messages.at(-1).attachments).toHaveLength(1);
  });

  it("refuses another user's file and writes nothing at all", async () => {
    const conversation = await makeConversation();
    const theirFile = await makeFile(strangerId, `${PREFIX}-theirs.pdf`);
    const before = await prisma.message.count({ where: { conversationId: conversation.id } });

    const res = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
      body: 'Trying to attach a stranger file.',
      fileIds: [theirFile.id],
    });

    // 404, not 403 — the caller must not learn the file exists.
    expect(res.status).toBe(404);
    expect(await prisma.messageAttachment.count({ where: { fileId: theirFile.id } })).toBe(0);
    // And crucially the message itself must not have been written.
    expect(await prisma.message.count({ where: { conversationId: conversation.id } })).toBe(before);
  });

  it('de-duplicates repeated file ids', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(memberId);

    const res = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
      body: 'Same file three times.',
      fileIds: [file.id, file.id, file.id],
    });
    expect(res.status).toBe(200);
    expect(await prisma.messageAttachment.count({ where: { fileId: file.id } })).toBe(1);
  });

  it('rejects a non-http link scheme', async () => {
    const conversation = await makeConversation();
    for (const url of ['notaurl', 'ftp://example.test/x', 'javascript:alert(1)']) {
      const res = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
        body: 'Link attached.',
        links: [{ url }],
      });
      expect(res.status, url).toBe(422);
    }
  });

  it('caps the number of attachments', async () => {
    const conversation = await makeConversation();
    const res = await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
      body: 'Too many.',
      fileIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(res.status).toBe(422);
  });

  it('carries attachments on a member-created thread', async () => {
    const file = await makeFile(memberId);
    const res = await asMember('post', '/api/v1/members/me/conversations').send({
      subject: `${PREFIX} new thread with a file`,
      category: 'Member Support',
      body: 'Opening message with an attachment.',
      fileIds: [file.id],
    });
    expect(res.status).toBe(201);
    expect(await prisma.messageAttachment.count({ where: { fileId: file.id } })).toBe(1);
  });

  it('does not orphan a conversation when the attachment is rejected', async () => {
    const theirFile = await makeFile(strangerId);
    const subject = `${PREFIX} should not exist`;

    const res = await asMember('post', '/api/v1/members/me/conversations').send({
      subject,
      category: 'Member Support',
      body: 'Opening message.',
      fileIds: [theirFile.id],
    });
    expect(res.status).toBe(404);
    expect(await prisma.conversation.count({ where: { subject } })).toBe(0);
  });

  it('lets an admin attach their own upload', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(adminId, `${PREFIX}-cro-letter.pdf`);

    const res = await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({
      body: 'Endorsement letter attached.',
      fileIds: [file.id],
    });
    expect(res.status).toBe(200);
    expect(await prisma.messageAttachment.count({ where: { fileId: file.id } })).toBe(1);
  });
});

describe('attachment visibility', () => {
  /** Puts a file on an admin-only note in a thread the member is part of. */
  async function internalNoteWithFile() {
    const conversation = await makeConversation();
    const file = await makeFile(adminId, `${PREFIX}-internal.pdf`, true);
    const res = await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({
      body: 'Internal: do not share this with the member.',
      internal: true,
      fileIds: [file.id],
    });
    expect(res.status).toBe(200);
    return { conversation, file };
  }

  it('hides an internal note attachment from the member thread', async () => {
    const { conversation } = await internalNoteWithFile();
    const view = await asMember('get', `/api/v1/members/me/conversations/${conversation.id}`);
    const everyAttachment = view.body.data.messages.flatMap((m: { attachments: unknown[] }) => m.attachments);
    expect(everyAttachment).toHaveLength(0);
  });

  it('refuses the member a download of an internal note attachment, but allows the admin', async () => {
    const { file } = await internalNoteWithFile();

    // The bytes are on disk, so the admin streaming a 200 proves the member's
    // 404 came from the ACL and not from a missing file.
    const memberTry = await asMember('get', `/api/v1/files/${file.id}/download`);
    expect(memberTry.status).toBe(404);

    const adminTry = await asAdmin('get', `/api/v1/files/${file.id}/download`);
    expect(adminTry.status).toBe(200);
  });

  it('shares a normal attachment with the other participant', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(adminId, `${PREFIX}-shared.pdf`, true);
    await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({
      body: 'Here is the letter.',
      fileIds: [file.id],
    });

    const view = await asMember('get', `/api/v1/members/me/conversations/${conversation.id}`);
    expect(view.body.data.messages.at(-1).attachments).toHaveLength(1);

    // A normal attachment really is downloadable by the other participant.
    const download = await asMember('get', `/api/v1/files/${file.id}/download`);
    expect(download.status).toBe(200);
  });
});

describe('GET /api/v1/members/me/documents', () => {
  it('lists attachments the member may see, with a correct total', async () => {
    const conversation = await makeConversation();
    const one = await makeFile(memberId, `${PREFIX}-one.pdf`);
    const two = await makeFile(memberId, `${PREFIX}-two.pdf`);
    await asMember('post', `/api/v1/members/me/conversations/${conversation.id}/messages`).send({
      body: 'Two files.',
      fileIds: [one.id, two.id],
    });

    const res = await asMember('get', '/api/v1/members/me/documents?limit=100');
    expect(res.status).toBe(200);
    const ours = res.body.data.items.filter((d: { name: string }) => d.name.startsWith(PREFIX));
    expect(ours).toHaveLength(2);
    expect(ours[0].direction).toBe('outgoing');
    // Paginated over attachments, not messages: two files on one message.
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(2);
  });

  it('excludes internal note attachments and their bodies', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(adminId, `${PREFIX}-secret.pdf`);
    await asAdmin('post', `/api/v1/admin/conversations/${conversation.id}/messages`).send({
      body: 'Internal: the member must never read this line.',
      internal: true,
      fileIds: [file.id],
    });

    const res = await asMember('get', '/api/v1/members/me/documents?limit=100');
    const names = res.body.data.items.map((d: { name: string }) => d.name);
    const notes = res.body.data.items.map((d: { note: string }) => d.note).join(' | ');
    expect(names).not.toContain(`${PREFIX}-secret.pdf`);
    expect(notes).not.toMatch(/must never read/);
  });
});

describe('CRO attachment transfers', () => {
  const formats = [
    ['pdf', 'application/pdf'], ['doc', 'application/msword'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['ppt', 'application/vnd.ms-powerpoint'], ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['jpeg', 'image/jpeg'], ['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'], ['txt', 'text/plain'], ['csv', 'text/csv'],
  ];
  for (const sender of ['member', 'admin'] as const) it.each(formats)(`${sender} → recipient preserves %s bytes, names, contextual access and receipts`, async (extension, mime) => {
    const bytes = await fsp.readFile(path.join(__dirname, 'fixtures/chat', `sample.${extension === 'jpg' ? 'jpeg' : extension}`));
    const name = `${PREFIX}-résumé.${extension}`;
    const send = sender === 'member' ? asMember : asAdmin;
    const receive = sender === 'member' ? asAdmin : asMember;
    const upload = await send('post', '/api/v1/files/upload').attach('file', bytes, { filename: name, contentType: 'application/octet-stream' });
    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    expect(upload.body.data.name).toBe(name); expect(upload.body.data.mimeType).toBe(mime);
    const fileId = upload.body.data.id;
    const conversation = await makeConversation({ withAdmin: false });
    const prefix = sender === 'member' ? '/members/me' : '/admin';
    const sent = await send('post', `/api/v1${prefix}/conversations/${conversation.id}/messages`).send({ body: 'File transfer', fileIds: [fileId] });
    expect(sent.status).toBe(200);
    const recipientPrefix = sender === 'member' ? '/admin' : '/members/me';
    const view = await receive('get', `/api/v1${recipientPrefix}/conversations/${conversation.id}`);
    const attachment = view.body.data.messages.at(-1).attachments[0];
    expect(attachment.id).toBe(fileId); expect(attachment.attachmentId).not.toBe(fileId);
    for (const action of ['download', 'preview']) {
      const response = await receive('get', `/api/v1/files/${fileId}/download`).query({ attachmentId: attachment.attachmentId, action }).buffer(true).parse((res, cb) => {
        const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(Buffer.from(chunk))); res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(response.status).toBe(200); expect(response.body).toEqual(bytes);
      expect(response.headers['content-length']).toBe(String(bytes.length));
      expect(response.headers['content-disposition']).toContain('attachment;');
      expect(response.headers['content-disposition']).toContain(extension);
      expect(response.headers['content-type']).toContain(mime);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    }
    expect((await asStranger('get', `/api/v1/files/${fileId}/download`)).status).toBe(404);
    await vi.waitFor(async () => expect(await prisma.attachmentOpen.count({ where: { attachmentId: attachment.attachmentId } })).toBe(1));
  });

  it('validates context before public flags, uploader grants and unrelated legitimate file ownership', async () => {
    const conversation = await makeConversation();
    const file = await makeFile(memberId, undefined, true);
    await prisma.fileObject.update({ where: { id: file.id }, data: { visibility: 'PUBLIC' } });
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId: adminId, senderName: 'CRO', senderRole: 'ADMIN', body: 'Internal', internal: true, attachments: { create: { fileId: file.id } } }, include: { attachments: true } });
    for (const query of [{}, { attachmentId: message.attachments[0]!.id }, { attachmentId: 'wrong' }]) {
      expect((await asMember('get', `/api/v1/files/${file.id}/download`).query(query)).status).toBe(404);
      expect((await asStranger('get', `/api/v1/files/${file.id}/download`).query(query)).status).toBe(404);
    }
    expect((await asAdmin('get', `/api/v1/files/${file.id}/download`).query({ attachmentId: 'wrong' })).status).toBe(404);
    expect((await asAdmin('get', `/api/v1/files/${file.id}/download`).query({ attachmentId: message.attachments[0]!.id })).status).toBe(200);
    const other = await makeFile(memberId, undefined, true);
    expect((await asMember('get', `/api/v1/files/${other.id}/download`)).status).toBe(200);
    expect((await asMember('get', `/api/v1/files/${other.id}/download`).query({ attachmentId: message.attachments[0]!.id })).status).toBe(404);
    for (const query of [{ action: 'open' }, { attachmentId: '' }, { action: ['preview', 'download'] }, { unexpected: 'value' }]) {
      expect((await asAdmin('get', `/api/v1/files/${file.id}/download`).query(query)).status).toBe(422);
    }
  });

  it('keeps independent project access but never lets it bypass an explicit chat context', async () => {
    const file = await makeFile(adminId, undefined, true);
    const conversation = await makeConversation();
    const message = await prisma.message.create({ data: { conversationId: conversation.id, senderId: adminId, senderName: 'CRO', senderRole: 'ADMIN', body: 'Internal', internal: true, attachments: { create: { fileId: file.id } } }, include: { attachments: true } });
    const project = await prisma.project.create({ data: { ownerId: memberId, title: 'Independent access', category: 'Research', description: 'Shared project file', files: { create: { fileId: file.id, kind: 'Document' } } } });
    const url = `/api/v1/files/${file.id}/download`;
    expect((await asMember('get', url)).status).toBe(200);
    expect((await asMember('get', url).query({ attachmentId: message.attachments[0]!.id })).status).toBe(404);
    await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
    expect((await asMember('get', url)).status).toBe(404);
  });

  it('returns a JSON unavailable response on early stream failure, never an empty successful download', async () => {
    const file = await makeFile(memberId, undefined, true);
    const open = fsp.open.bind(fsp);
    const injected = vi.spyOn(fsp, 'open').mockImplementationOnce(async (...args) => {
      const handle = await open(...args);
      const create = handle.createReadStream.bind(handle);
      vi.spyOn(handle, 'createReadStream').mockImplementationOnce(options => {
        const stream = create(options); stream.destroy(new Error('Injected read failure')); return stream;
      });
      return handle;
    });
    try {
      const response = await asMember('get', `/api/v1/files/${file.id}/download`);
      expect(response.status).toBe(404); expect(response.body.message).toBe('File is unavailable');
      expect(response.headers['content-disposition']).toBeUndefined();
    } finally { injected.mockRestore(); }
  });

  it('denies anonymous, inactive and revoked-session downloads', async () => {
    const file = await makeFile(adminId, undefined, true);
    const url = `/api/v1/files/${file.id}/download`;
    expect((await request(app).get(url)).status).toBe(401);
    await prisma.user.update({ where: { id: adminId }, data: { status: 'SUSPENDED' } });
    expect((await asAdmin('get', url)).status).toBe(401);
    await prisma.user.update({ where: { id: adminId }, data: { status: 'ACTIVE' } });
    await prisma.session.updateMany({ where: { userId: adminId }, data: { revokedAt: new Date() } });
    expect((await asAdmin('get', url)).status).toBe(401);
  });

  it.each(['missing', 'deleted', 'empty', 'size', 'unreadable', 'directory', 'symlink', 'traversal'])('safely rejects %s storage without access-granted auditing', async kind => {
    const file = await makeFile(memberId, undefined, true);
    const absolute = path.join(uploadRoot, file.storageKey);
    if (kind === 'missing') await fsp.unlink(absolute);
    if (kind === 'deleted') await prisma.fileObject.update({ where: { id: file.id }, data: { deletedAt: new Date() } });
    if (kind === 'empty') await fsp.writeFile(absolute, '');
    if (kind === 'size') await fsp.writeFile(absolute, 'truncated');
    if (kind === 'unreadable') await fsp.chmod(absolute, 0);
    if (kind === 'directory') { await fsp.unlink(absolute); await fsp.mkdir(absolute); }
    if (kind === 'symlink') { await fsp.unlink(absolute); await fsp.symlink('/etc/hosts', absolute); }
    if (kind === 'traversal') await prisma.fileObject.update({ where: { id: file.id }, data: { storageKey: '../outside' } });
    const before = await prisma.auditLog.count({ where: { actorId: memberId, action: 'FileAccessGranted' } });
    const response = await asMember('get', `/api/v1/files/${file.id}/download`);
    expect(response.status).toBe(404); expect(response.body.message).not.toContain(uploadRoot);
    expect(response.headers['content-disposition']).toBeUndefined();
    expect(await prisma.auditLog.count({ where: { actorId: memberId, action: 'FileAccessGranted' } })).toBe(before);
    if (kind === 'unreadable') await fsp.chmod(absolute, 0o600);
    if (kind === 'directory') await fsp.rmdir(absolute);
    if (kind === 'traversal') await prisma.fileObject.update({ where: { id: file.id }, data: { storageKey: file.storageKey } });
  });
});
