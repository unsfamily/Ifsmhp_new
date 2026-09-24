import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityMembershipStatus } from '@prisma/client';
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), verifyTransport: vi.fn(), sendApprovalEmail: vi.fn() }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath } from '../utils/fileStorage';
import * as audits from '../services/audit.service';

const app = createApp(), prefix = `member-status-${randomUUID()}`;
type Actor = { id: string; token: string };
let admin: Actor, member: Actor, moderator: Actor, outsider: Actor;
let communityId: string, membershipId: string, conversationId: string;
const actors: Actor[] = [];
const call = (actor: Actor, method: 'get' | 'post' | 'patch', url: string) => request(app)[method]('/api/v1' + url).auth(actor.token, { type: 'bearer' });
const url = () => `/admin/community/members/${membershipId}/status`;
const change = (status: string, expectedStatus: string, reason?: string, actor = admin) => call(actor, 'patch', url()).send({ status, expectedStatus, reason });
const stored = () => prisma.communityMembership.findUniqueOrThrow({ where: { id: membershipId } });
const countAudit = () => prisma.auditLog.count({ where: { entityId: membershipId, action: 'CommunityMembershipstatus' } });
async function makeActor(role: 'ADMIN' | 'MEMBER') {
  const user = await prisma.user.create({ data: { email: `${prefix}-${randomUUID()}@example.test`, fullName: role, role, status: 'ACTIVE' } });
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(randomUUID()), expiresAt: new Date(Date.now() + 3600000) } });
  const actor = { id: user.id, token: signAccessToken({ sub: user.id, role, sessionId: session.id }) }; actors.push(actor); return actor;
}
beforeAll(async () => { admin = await makeActor('ADMIN'); member = await makeActor('MEMBER'); moderator = await makeActor('MEMBER'); outsider = await makeActor('MEMBER'); });
beforeEach(async () => {
  const community = await prisma.community.create({ data: { name: 'Status test community', slug: `${prefix}-${randomUUID()}`, description: 'Status lifecycle fixture', category: 'Research', visibility: 'PUBLIC', status: 'ACTIVE', createdById: admin.id,
    memberships: { create: [{ userId: admin.id, role: 'ADMIN', status: 'ACTIVE' }, { userId: member.id, role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date('2024-01-02T12:00:00Z') }, { userId: moderator.id, role: 'MODERATOR', status: 'ACTIVE' }] },
    conversations: { create: { title: 'General' } } }, include: { memberships: true, conversations: true } });
  communityId = community.id; membershipId = community.memberships.find(m => m.userId === member.id)!.id; conversationId = community.conversations[0]!.id;
});
afterEach(async () => {
  vi.restoreAllMocks();
  const files = await prisma.fileObject.findMany({ where: { communityManaged: true, uploaderId: { in: actors.map(a => a.id) } } });
  await prisma.community.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
});
afterAll(async () => { await prisma.auditLog.deleteMany({ where: { actorId: { in: actors.map(a => a.id) } } }); await prisma.user.deleteMany({ where: { id: { in: actors.map(a => a.id) } } }); await prisma.$disconnect(); });

describe('Community member status recovery', () => {
  it.each(['BLOCKED', 'SUSPENDED'] as const)('completes ACTIVE → %s → ACTIVE with restored content/file access and unchanged account, role and other memberships', async status => {
    const before = await stored();
    const other = await prisma.community.create({ data: { name: 'Other community', slug: `${prefix}-${randomUUID()}`, description: '', category: 'Research', visibility: 'PUBLIC', status: 'ACTIVE', createdById: admin.id, memberships: { create: { userId: member.id, status: 'ACTIVE' } } } });
    const upload = await call(member, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Status cycle attachment').attach('attachments', Buffer.from('Persisted attachment'), { filename: 'cycle.txt', contentType: 'text/plain' });
    expect(upload.status).toBe(201); const fileUrl = upload.body.data.attachments[0].fileUrl;
    const restricted = await change(status, 'ACTIVE', 'Restriction reason'); expect(restricted.status).toBe(200);
    expect(restricted.body.data.availableStatusActions).toEqual([status === 'BLOCKED' ? 'UNBLOCK' : 'UNSUSPEND']);
    expect((await call(member, 'get', `/community/conversations/${conversationId}/messages`)).status).toBe(404);
    expect((await call(member, 'get', fileUrl)).status).toBe(404);
    expect((await call(member, 'post', `/community/conversations/${conversationId}/messages`).send({ content: 'Cannot post' })).status).toBe(404);
    const detail = await call(admin, 'get', `/admin/community/members/${membershipId}`);
    const list = await call(admin, 'get', `/admin/community/members?communityId=${communityId}&status=${status}`);
    expect(detail.body.data.status).toBe(status); expect(list.body.data.items[0].availableStatusActions).toEqual(detail.body.data.availableStatusActions);
    const restored = await change('ACTIVE', status, status === 'SUSPENDED' ? 'Reviewed and restored' : undefined); expect(restored.status).toBe(200);
    expect(restored.body.data.availableStatusActions).toEqual(['BLOCK', 'SUSPEND']);
    const after = await stored(); expect(after).toMatchObject({ status: 'ACTIVE', role: before.role, joinedAt: before.joinedAt, reason: status === 'SUSPENDED' ? 'Reviewed and restored' : null });
    expect((await call(member, 'get', `/community/conversations/${conversationId}/messages`)).status).toBe(200);
    expect((await call(member, 'get', fileUrl)).text).toBe('Persisted attachment');
    expect((await call(member, 'post', `/community/conversations/${conversationId}/messages`).send({ content: 'Restored post' })).status).toBe(201);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).status).toBe('ACTIVE');
    expect((await prisma.communityMembership.findUniqueOrThrow({ where: { communityId_userId: { communityId: other.id, userId: member.id } } })).status).toBe('ACTIVE');
    expect(await countAudit()).toBe(2);
    const events = await prisma.auditLog.findMany({ where: { entityId: membershipId, action: 'CommunityMembershipstatus' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    expect(events.map(e => e.changes)).toEqual([{ status: { before: 'ACTIVE', after: status } }, { status: { before: status, after: 'ACTIVE' } }]);
  });
  it.each(['ACTIVE', 'REJECTED'] as const)('preserves pending approval/rejection to %s', async status => {
    await prisma.communityMembership.update({ where: { id: membershipId }, data: { status: 'PENDING', joinedAt: null } });
    const response = await change(status, 'PENDING', status === 'REJECTED' ? 'Not eligible' : undefined); expect(response.status).toBe(200);
    expect((await stored()).joinedAt === null).toBe(status !== 'ACTIVE');
  });
  it('permits scoped moderator restoration but denies ordinary members, other communities, self and protected targets', async () => {
    expect((await change('BLOCKED', 'ACTIVE', 'Reason', member)).status).toBe(403);
    expect((await change('BLOCKED', 'ACTIVE', 'Reason', outsider)).status).toBe(403);
    expect((await change('SUSPENDED', 'ACTIVE', 'Reason', moderator)).status).toBe(200);
    expect((await change('ACTIVE', 'SUSPENDED', undefined, moderator)).status).toBe(200);
    await prisma.communityMembership.update({ where: { id: membershipId }, data: { role: 'MODERATOR' } });
    expect((await change('BLOCKED', 'ACTIVE', 'Reason', moderator)).status).toBe(403);
    expect((await call(moderator, 'get', `/admin/community/members/${membershipId}`)).body.data.availableStatusActions).toEqual([]);
    expect((await change('BLOCKED', 'ACTIVE', 'Reason')).status).toBe(200);
    expect((await change('ACTIVE', 'BLOCKED')).status).toBe(200);
    expect((await stored()).role).toBe('MODERATOR');
    await prisma.communityMembership.update({ where: { id: membershipId }, data: { role: 'ADMIN' } });
    expect((await change('BLOCKED', 'ACTIVE', 'Reason')).status).toBe(403);
    expect((await call(admin, 'get', `/admin/community/members/${membershipId}`)).body.data.availableStatusActions).toEqual([]);
    const self = await prisma.communityMembership.findUniqueOrThrow({ where: { communityId_userId: { communityId, userId: admin.id } } });
    expect((await call(admin, 'patch', `/admin/community/members/${self.id}/status`).send({ status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: 'No' })).status).toBe(403);
  });
  it.each([
    {}, { status: 'BLOCKED' }, { status: 'BLOCKED', expectedStatus: null }, { status: 'BLOCKED', expectedStatus: 'ACTIVE' },
    { status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: '  ' }, { status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: 'x'.repeat(2001) },
    { status: 'ACTIVE', expectedStatus: 'BLOCKED', reason: null }, { status: 'INVALID', expectedStatus: 'ACTIVE' },
    { status: 1, expectedStatus: 'ACTIVE' }, { status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: 'Reason', userId: 'another' },
  ])('rejects malformed input without writes (%j)', async body => {
    const before = await stored(); expect((await call(admin, 'patch', url()).send(body)).status).toBe(422);
    expect(await stored()).toEqual(before); expect(await countAudit()).toBe(0);
  });
  const allowed: Record<CommunityMembershipStatus, CommunityMembershipStatus[]> = { PENDING: ['ACTIVE', 'REJECTED'], ACTIVE: ['BLOCKED', 'SUSPENDED'], BLOCKED: ['ACTIVE'], SUSPENDED: ['ACTIVE'], REJECTED: [] };
  for (const from of Object.keys(allowed) as CommunityMembershipStatus[]) for (const to of Object.keys(allowed) as CommunityMembershipStatus[]) if (!allowed[from].includes(to)) {
    it(`rejects directory transition ${from} → ${to}`, async () => {
      await prisma.communityMembership.update({ where: { id: membershipId }, data: { status: from } });
      expect((await change(to, from, 'Reason')).status).toBe(409); expect((await stored()).status).toBe(from); expect(await countAudit()).toBe(0);
    });
  }
  it('serializes concurrent decisions, rejects lost-response retries and never interprets stale Unsuspend as Unblock', async () => {
    const responses = await Promise.all([change('BLOCKED', 'ACTIVE', 'First'), change('SUSPENDED', 'ACTIVE', 'Second')]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]); expect(await countAudit()).toBe(1);
    const current = await stored(); expect((await change(current.status, 'ACTIVE', 'Retry')).status).toBe(409); expect(await countAudit()).toBe(1);
    if (current.status !== 'BLOCKED') { await change('ACTIVE', current.status); await change('BLOCKED', 'ACTIVE', 'Block'); }
    const before = await countAudit(); expect((await change('ACTIVE', 'SUSPENDED')).status).toBe(409); expect((await stored()).status).toBe('BLOCKED'); expect(await countAudit()).toBe(before);
  });
  it('accepts the reason boundary, clears blank restoration notes and preserves an unknown historical join date', async () => {
    await prisma.communityMembership.update({ where: { id: membershipId }, data: { joinedAt: null } });
    expect((await change('BLOCKED', 'ACTIVE', 'x'.repeat(2000))).status).toBe(200);
    expect((await change('ACTIVE', 'BLOCKED', '   ')).status).toBe(200);
    expect(await stored()).toMatchObject({ joinedAt: null, reason: null, status: 'ACTIVE' });
  });
  it('denies cross-community moderator mutations and protects global administrators with ordinary community roles', async () => {
    const other = await prisma.community.create({ data: { name: 'Other community', slug: `${prefix}-${randomUUID()}`, description: '', category: 'Research', visibility: 'PUBLIC', status: 'ACTIVE', createdById: admin.id, memberships: { create: { userId: member.id, status: 'ACTIVE' } } }, include: { memberships: true } });
    expect((await call(moderator, 'patch', `/admin/community/members/${other.memberships[0]!.id}/status`).send({ status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: 'Wrong scope' })).status).toBe(404);
    await prisma.user.update({ where: { id: member.id }, data: { role: 'ADMIN' } });
    try {
      expect((await call(admin, 'get', `/admin/community/members/${membershipId}`)).body.data.availableStatusActions).toEqual([]);
      expect((await change('BLOCKED', 'ACTIVE', 'Protected')).status).toBe(403);
    } finally { await prisma.user.update({ where: { id: member.id }, data: { role: 'MEMBER' } }); }
  });
  it('rolls back membership status and reason when auditing fails', async () => {
    const before = await stored(); vi.spyOn(audits, 'writeAudit').mockRejectedValueOnce(new Error('Injected status audit failure'));
    expect((await change('BLOCKED', 'ACTIVE', 'Reason')).status).toBe(500); expect(await stored()).toEqual(before); expect(await countAudit()).toBe(0);
  });
  it('denies anonymous, inactive and revoked administrators and removed memberships', async () => {
    expect((await request(app).patch('/api/v1' + url()).send({ status: 'BLOCKED', expectedStatus: 'ACTIVE', reason: 'No' })).status).toBe(401);
    const inactive = await makeActor('ADMIN'); await prisma.user.update({ where: { id: inactive.id }, data: { status: 'SUSPENDED' } });
    expect((await change('BLOCKED', 'ACTIVE', 'No', inactive)).status).toBe(401);
    const revoked = await makeActor('ADMIN'); await prisma.session.updateMany({ where: { userId: revoked.id }, data: { revokedAt: new Date() } });
    expect((await change('BLOCKED', 'ACTIVE', 'No', revoked)).status).toBe(401);
    await prisma.communityMembership.update({ where: { id: membershipId }, data: { removedAt: new Date() } });
    expect((await change('BLOCKED', 'ACTIVE', 'No')).status).toBe(404); expect(await countAudit()).toBe(0);
  });
  it('restores restrictions imposed through reports without closing or rewriting the report', async () => {
    await prisma.communityMembership.create({ data: { communityId, userId: outsider.id, status: 'ACTIVE' } });
    const reported = await call(outsider, 'post', `/community/members/${membershipId}/report`).send({ reason: 'Review membership', submissionId: randomUUID(), communityId });
    expect(reported.status).toBe(201); const reportUrl = `/admin/community/reports/${reported.body.data.reportId}`;
    const enforce = async (action: string) => { const report = (await call(admin, 'get', reportUrl)).body.data; return call(admin, 'post', reportUrl + '/actions').send({ action, notes: 'Moderation reason', operationId: randomUUID(), expectedRevision: report.revision, expectedTargetVersion: report.targetVersion }); };
    expect((await enforce('SUSPEND_MEMBER')).status).toBe(200); expect((await enforce('BLOCK_MEMBER')).status).toBe(200);
    const before = await prisma.communityReport.findUniqueOrThrow({ where: { id: reported.body.data.reportId }, include: { actionHistory: true } });
    expect((await change('ACTIVE', 'BLOCKED', 'Restored in directory')).status).toBe(200);
    expect(await prisma.communityReport.findUniqueOrThrow({ where: { id: before.id }, include: { actionHistory: true } })).toEqual(before);
  });
});
