import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SupportStatus } from '@prisma/client';

vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), verifyTransport: vi.fn(), sendApprovalEmail: vi.fn() }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { sha256, signAccessToken } from '../utils/security';
import { conversationForSupport } from '../services/support.service';

const app = createApp();
const prefix = `support-test-${crypto.randomUUID()}`;
type Actor = { id: string; token: string };
let member: Actor, other: Actor, admin: Actor, inactive: Actor, expired: Actor;
let projectId: string;
const ids: string[] = [];
const userIds: string[] = [];
const storedFiles: Array<{ id: string; storageKey: string }> = [];
const root = path.resolve(process.cwd(), env.UPLOAD_STORAGE_PATH);
const call = (actor: Actor, method: 'get' | 'post' | 'patch', url: string) => request(app)[method](url).set('Authorization', `Bearer ${actor.token}`);
const memberUrl = '/api/v1/members/me/support';
const adminUrl = '/api/v1/admin/support';
async function actor(name: string, role: 'MEMBER' | 'ADMIN', active = true, expires = false) {
  const user = await prisma.user.create({ data: { fullName: `${prefix} ${name}`, email: `${prefix}.${name}@example.test`, role, status: active ? 'ACTIVE' : 'SUSPENDED' } });
  userIds.push(user.id);
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(crypto.randomUUID()), expiresAt: new Date(Date.now() + (expires ? -1000 : 3600000)) } });
  return { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}
async function create(extra: Record<string, unknown> = {}) {
  const res = await call(member, 'post', memberUrl).send({ subject: `${prefix} request`, description: 'Please help with our research project.', types: ['Moral', 'Funding'], ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  ids.push(res.body.data.id);
  return res.body.data;
}
async function file(owner: Actor, name: string) {
  const storageKey = `${prefix}-${crypto.randomUUID()}.pdf`;
  const bytes = Buffer.from('%PDF-1.4\n%%EOF');
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, storageKey), bytes);
  const row = await prisma.fileObject.create({ data: { uploaderId: owner.id, storageKey, originalName: name, mimeType: 'application/pdf', sizeBytes: bytes.length } });
  storedFiles.push(row);
  return row;
}
beforeAll(async () => {
  member = await actor('member', 'MEMBER'); other = await actor('other', 'MEMBER'); admin = await actor('admin', 'ADMIN');
  inactive = await actor('inactive', 'MEMBER', false); expired = await actor('expired', 'MEMBER', true, true);
  await prisma.memberProfile.create({ data: { userId: member.id, memberId: prefix, institution: 'Support Test Institute', professionalType: 'Scientist' } });
  const project = await prisma.project.create({ data: { ownerId: member.id, title: `${prefix} linked project`, category: 'Research', description: 'Persisted research project.' } });
  projectId = project.id;
});
afterAll(async () => {
  const requests = await prisma.supportRequest.findMany({ where: { requesterId: { in: userIds } }, select: { id: true, conversationId: true } });
  const requestIds = requests.map((r) => r.id);
  await prisma.notification.deleteMany({ where: { OR: requestIds.map((id) => ({ link: { endsWith: `/support/${id}` } })) } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.supportRequest.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.conversation.deleteMany({ where: { id: { in: requests.flatMap((r) => r.conversationId ? [r.conversationId] : []) } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: storedFiles.map((f) => f.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await Promise.all(storedFiles.map((f) => fs.unlink(path.join(root, f.storageKey)).catch(() => undefined)));
  await prisma.$disconnect();
});

describe('support creation and access', () => {
  it('atomically persists project-optional requests, deduplicated types, conversation, history, audit and notifications', async () => {
    for (const project of [null, projectId]) {
      const detail = await create({ projectId: project, types: ['Moral', 'Moral Support', 'Funding'], requiredBy: '2026-12-31' });
      expect(detail.projectId).toBe(project);
      expect(detail.type.sort()).toEqual(['Funding', 'Moral']);
      expect(detail.messages).toHaveLength(1);
      const row = await prisma.supportRequest.findUniqueOrThrow({ where: { id: detail.id }, include: { types: true, histories: true, conversation: { include: { participants: true } } } });
      expect(row.types).toHaveLength(2); expect(row.histories).toHaveLength(1);
      expect(row.conversation?.participants.map((p) => p.userId)).toEqual(expect.arrayContaining([member.id, admin.id]));
      expect(await prisma.auditLog.count({ where: { entity: `SupportRequest ${detail.id}` } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: admin.id, link: `/admin/support/${detail.id}` } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: member.id, link: `/dashboard/support/${detail.id}` } })).toBe(1);
    }
  });
  it('validates fields, real dates, protected values and project ownership without partial writes', async () => {
    const base = { subject: `${prefix} invalid`, description: 'Valid description', types: ['Moral'] };
    const before = await prisma.supportRequest.count({ where: { requesterId: member.id } });
    for (const bad of [{ subject: ' ' }, { description: 'tiny' }, { types: [] }, { types: ['Unknown'] }, { priority: 'Low' }, { requiredBy: '2026-02-30' }, { requiredBy: 'tomorrow' }, { requesterId: other.id }, { status: 'APPROVED' }]) {
      expect((await call(member, 'post', memberUrl).send({ ...base, ...bad })).status).toBe(422);
    }
    expect((await call(other, 'post', memberUrl).send({ ...base, projectId })).status).toBe(404);
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
    expect((await call(member, 'post', memberUrl).send({ ...base, projectId })).status).toBe(404);
    await prisma.project.update({ where: { id: projectId }, data: { deletedAt: null } });
    expect(await prisma.supportRequest.count({ where: { requesterId: member.id } })).toBe(before);
  });
  it('requires active sessions and isolates detail, replies and management', async () => {
    const detail = await create();
    for (const url of [memberUrl, `${memberUrl}/${detail.id}`, adminUrl, `${adminUrl}/${detail.id}`]) expect((await request(app).get(url)).status).toBe(401);
    for (const user of [inactive, expired]) {
      expect((await call(user, 'get', memberUrl)).status).toBe(401);
      expect((await call(user, 'post', `${memberUrl}/${detail.id}/messages`).send({ body: 'No access' })).status).toBe(401);
    }
    expect((await call(other, 'get', `${memberUrl}/${detail.id}`)).status).toBe(404);
    expect((await call(other, 'post', `${memberUrl}/${detail.id}/messages`).send({ body: 'No access' })).status).toBe(404);
    expect((await call(other, 'get', memberUrl)).body.data.items).toHaveLength(0);
    expect((await call(member, 'get', adminUrl)).status).toBe(403);
    expect((await call(member, 'patch', `${adminUrl}/${detail.id}`).send({ priority: 'Low' })).status).toBe(403);
    expect((await call(member, 'post', `${adminUrl}/${detail.id}/approve`).send({})).status).toBe(403);
    expect((await call(admin, 'get', `${adminUrl}/unknown`)).status).toBe(404);
  });
});

describe('queue and decisions', () => {
  it('filters before counting/paging; supports every status and dataset-wide metrics', async () => {
    const statuses: SupportStatus[] = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'];
    const rows = await prisma.$transaction(Array.from({ length: 27 }, (_, i) => prisma.supportRequest.create({ data: {
      requesterId: member.id, projectId, subject: `${prefix} pagination ${i}`, description: 'Pagination fixture', status: statuses[i % 5], priority: i % 2 ? 'Urgent' : 'Low',
      createdAt: new Date('2026-01-01T12:00:00Z'), types: { create: { kind: 'OFFICIAL' } },
    } })));
    ids.push(...rows.map((r) => r.id));
    const first = await call(member, 'get', memberUrl).query({ q: 'pagination' });
    expect(first.body.data.items).toHaveLength(20); expect(first.body.data.pagination.total).toBe(27);
    const second = await call(member, 'get', memberUrl).query({ q: 'pagination', page: 2 });
    expect(second.body.data.items).toHaveLength(7);
    expect(new Set([...first.body.data.items, ...second.body.data.items].map((r: { id: string }) => r.id)).size).toBe(27);
    const filtered = await call(admin, 'get', adminUrl).query({ q: `${prefix} pagination`, status: 'Pending', priority: 'Low', supportType: 'Official Support', member: prefix, submittedDate: '2026-01-01' });
    expect(filtered.body.data.pagination.total).toBe(3);
    const all = await call(member, 'get', memberUrl);
    expect(first.body.data.stats).toEqual(all.body.data.stats);
    expect(first.body.data.stats.avgResponseDays).toBeNull();
    expect(first.body.data.stats.overSla).toBeGreaterThanOrEqual(11);
    for (const status of ['Open', 'In Review', 'Approved', 'Rejected', 'Closed']) {
      const res = await call(member, 'get', memberUrl).query({ q: 'pagination', status });
      expect(res.body.data.items.every((r: { status: string }) => r.status === status)).toBe(true);
      expect(res.body.data.pagination.total).toBeGreaterThan(0);
    }
    for (const query of [{ status: 'Made up' }, { supportType: 'Other' }, { priority: 'Critical' }, { page: 0 }, { submittedDate: 'bad' }]) expect((await call(admin, 'get', adminUrl).query(query)).status).toBe(422);
  });
  it('validates assignment/priority, maintains legacy labels and rejects stale updates', async () => {
    const detail = await create();
    const changed = await call(admin, 'patch', `${adminUrl}/${detail.id}`).send({ assignedAdminId: admin.id, priority: 'Low', expectedUpdatedAt: detail.lastUpdate });
    expect(changed.status).toBe(200); expect(changed.body.data.assignedAdminId).toBe(admin.id);
    expect(changed.body.data.priority).toBe('Low');
    expect((await call(admin, 'patch', `${adminUrl}/${detail.id}`).send({ assignedAdminId: member.id })).status).toBe(422);
    expect((await call(admin, 'patch', `${adminUrl}/${detail.id}`).send({ priority: 'High', expectedUpdatedAt: detail.lastUpdate })).status).toBe(409);
    expect((await call(admin, 'patch', `${adminUrl}/${detail.id}`).send({ requesterId: other.id })).status).toBe(422);
    expect((await call(admin, 'patch', `${adminUrl}/${detail.id}`).send({ assignedAdminId: null })).body.data.assignedAdmin).toBe('Unassigned');
    const assignees = await call(admin, 'get', `${adminUrl}/assignees`);
    expect(assignees.body.data.some((a: { id: string }) => a.id === admin.id)).toBe(true);
    expect(assignees.body.data.some((a: { id: string }) => a.id === member.id)).toBe(false);
  });
  it('persists review/approval/completion and keeps private notes out of member content/counts', async () => {
    const detail = await create();
    const url = `${adminUrl}/${detail.id}`;
    expect((await call(admin, 'post', `${url}/complete`).send({ response: 'Premature completion' })).status).toBe(409);
    expect((await call(admin, 'post', `${url}/review`).send({})).status).toBe(422);
    expect((await call(admin, 'post', `${url}/review`).send({ reviewNotes: 'PRIVATE triage rationale' })).status).toBe(200);
    const memberDetail = await call(member, 'get', `${memberUrl}/${detail.id}`);
    expect(memberDetail.body.data.status).toBe('In Review');
    expect(JSON.stringify(memberDetail.body)).not.toContain('PRIVATE');
    expect(memberDetail.body.data.messages).toHaveLength(1);
    const memberList = await call(member, 'get', memberUrl).query({ q: detail.id });
    expect(memberList.body.data.items[0].messages).toBe(1); expect(memberList.body.data.items[0].lastMessage).not.toContain('PRIVATE');
    const notifications = await prisma.notification.findMany({ where: { userId: member.id, link: `/dashboard/support/${detail.id}` } });
    expect(JSON.stringify(notifications)).not.toContain('PRIVATE');
    expect((await call(admin, 'post', `${url}/approve`).send({ response: 'PUBLIC approval response' })).status).toBe(200);
    expect((await call(admin, 'post', `${url}/complete`).send({ response: 'PUBLIC completion response' })).status).toBe(200);
    expect((await call(admin, 'post', `${url}/reject`).send({ response: 'Cannot reopen' })).status).toBe(409);
    const row = await prisma.supportRequest.findUniqueOrThrow({ where: { id: detail.id }, include: { histories: true } });
    expect(row.status).toBe('COMPLETED'); expect(row.histories).toHaveLength(4);
    expect((await call(member, 'get', `${memberUrl}/${detail.id}`)).body.data.messages).toHaveLength(3);
  });
  it('allows exactly one concurrent decision and no partial losing decision writes', async () => {
    const detail = await create();
    const results = await Promise.all(['approve', 'reject'].map((action) => call(admin, 'post', `${adminUrl}/${detail.id}/${action}`).send({ response: `${action} response`, expectedUpdatedAt: detail.lastUpdate })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.supportRequestHistory.count({ where: { requestId: detail.id } })).toBe(2);
    expect(await prisma.message.count({ where: { conversationId: detail.conversationId } })).toBe(2);
  });
  it('supports direct rejection and direct approval, requiring public rejection/completion notes', async () => {
    for (const action of ['approve', 'reject']) {
      const detail = await create();
      if (action === 'reject') expect((await call(admin, 'post', `${adminUrl}/${detail.id}/reject`).send({})).status).toBe(422);
      expect((await call(admin, 'post', `${adminUrl}/${detail.id}/${action}`).send({ response: `${action} response` })).status).toBe(200);
      if (action === 'approve') expect((await call(admin, 'post', `${adminUrl}/${detail.id}/complete`).send({})).status).toBe(422);
      else expect((await call(admin, 'post', `${adminUrl}/${detail.id}/review`).send({ response: 'Reopen' })).status).toBe(409);
    }
  });
});

describe('shared conversations and legacy requests', () => {
  it('synchronizes bidirectional replies with Messages and permits terminal follow-ups', async () => {
    for (const terminal of ['COMPLETED', 'REJECTED'] as const) {
      const detail = await create();
      await prisma.supportRequest.update({ where: { id: detail.id }, data: { status: terminal, updatedAt: new Date('2026-01-01') } });
      expect((await call(member, 'post', `${memberUrl}/${detail.id}/messages`).send({ body: 'Member follow-up' })).status).toBe(201);
      expect((await call(admin, 'post', `/api/v1/admin/conversations/${detail.conversationId}/messages`).send({ body: 'Inbox admin response' })).status).toBe(200);
      expect((await call(member, 'post', `/api/v1/members/me/conversations/${detail.conversationId}/messages`).send({ body: 'Inbox member response' })).status).toBe(200);
      const view = await call(member, 'get', `${memberUrl}/${detail.id}`);
      expect(view.body.data.messages).toHaveLength(4); expect(view.body.data.statusCode).toBe(terminal);
      expect(new Date(view.body.data.lastUpdate).getTime()).toBeGreaterThan(Date.now() - 60000);
      const inbox = await call(member, 'get', `/api/v1/members/me/conversations/${detail.conversationId}`);
      expect(inbox.body.data.messages.map((m: { text: string }) => m.text)).toEqual(view.body.data.messages.map((m: { text: string }) => m.text));
      expect((await call(member, 'post', `${memberUrl}/${detail.id}/messages`).send({ body: ' ' })).status).toBe(422);
    }
  });
  it('shares public attachments, hides private/deleted attachments, and checks upload/download ownership', async () => {
    const detail = await create();
    const publicFile = await file(admin, 'public.pdf'), privateFile = await file(admin, 'private.pdf'), foreignFile = await file(other, 'foreign.pdf');
    expect((await call(admin, 'post', `${adminUrl}/${detail.id}/messages`).send({ body: 'Public attachment', fileIds: [publicFile.id] })).status).toBe(201);
    expect((await call(admin, 'post', `${adminUrl}/${detail.id}/messages`).send({ body: 'PRIVATE attachment', internal: true, fileIds: [privateFile.id] })).status).toBe(201);
    expect((await call(member, 'post', `${memberUrl}/${detail.id}/messages`).send({ body: 'Forged file', fileIds: [foreignFile.id] })).status).toBe(404);
    const view = await call(member, 'get', `${memberUrl}/${detail.id}`);
    expect(view.body.data.attachments.map((f: { id: string }) => f.id)).toEqual([publicFile.id]);
    expect(JSON.stringify(view.body)).not.toMatch(/storageKey|PRIVATE|private.pdf/);
    expect((await call(member, 'get', `/api/v1/files/${publicFile.id}/download`)).status).toBe(200);
    expect((await call(other, 'get', `/api/v1/files/${publicFile.id}/download`)).status).toBe(404);
    expect((await call(member, 'get', `/api/v1/files/${privateFile.id}/download`)).status).toBe(404);
    expect((await call(admin, 'get', `/api/v1/files/${privateFile.id}/download`)).status).toBe(200);
    await prisma.fileObject.update({ where: { id: publicFile.id }, data: { deletedAt: new Date() } });
    expect((await call(member, 'get', `${memberUrl}/${detail.id}`)).body.data.attachments).toHaveLength(0);
  });
  it('backfills idempotently without guessing legacy assignees or response timestamps', async () => {
    const createdAt = new Date('2025-01-01'), updatedAt = new Date('2025-02-01');
    const legacy = await prisma.supportRequest.create({ data: { requesterId: member.id, subject: `${prefix} legacy`, description: 'Original description', adminResponse: 'Legacy response', assignedAdmin: 'Legacy office label', createdAt, updatedAt, histories: { create: { toStatus: 'PENDING', note: 'PRIVATE legacy note' } } } });
    ids.push(legacy.id);
    const conversationId = await conversationForSupport(legacy.id);
    expect(await conversationForSupport(legacy.id)).toBe(conversationId);
    const row = await prisma.supportRequest.findUniqueOrThrow({ where: { id: legacy.id }, include: { conversation: { include: { messages: true } } } });
    expect(row.updatedAt).toEqual(updatedAt); expect(row.assignedAdminId).toBeNull(); expect(row.assignedAdmin).toBe('Legacy office label');
    expect(row.conversation?.messages).toHaveLength(1); expect(row.conversation?.messages[0]?.createdAt).toEqual(createdAt);
    expect(row.adminResponse).toBe('Legacy response');
    expect(JSON.stringify((await call(member, 'get', `${memberUrl}/${legacy.id}`)).body)).not.toContain('PRIVATE');
  });
});
