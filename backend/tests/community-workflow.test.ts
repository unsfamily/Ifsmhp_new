import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
vi.mock('../services/mail.service', () => ({ sendOtpEmail: vi.fn(), verifyTransport: vi.fn(), sendApprovalEmail: vi.fn() }));
import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';
import { assertSafePath, uploadRoot } from '../utils/fileStorage';
import { env } from '../config';
import * as communityAccess from '../services/community-access.service';

const app = createApp();
const prefix = 'community-workflow-test';
const root = '/api/v1';
type Actor = { id: string; token: string };
let admin: Actor, alice: Actor, bob: Actor, moderator: Actor, outsider: Actor, inactive: Actor, applicant: Actor;
const actors: Actor[] = [];
let id: string, conversationId: string;
const payload = { name: 'Clinical Network', slug: `${prefix}-clinical`, description: 'Research and collaboration', category: 'Clinical', visibility: 'PUBLIC', status: 'ACTIVE' };
const as = (actor: Actor, method: 'get' | 'post' | 'patch' | 'delete', url: string) => request(app)[method](`${root}${url}`).set('Authorization', `Bearer ${actor.token}`);
// Existing lifecycle cases use fresh preconditions; conflict/retry cases below send explicit versions.
const decisionAs = (who: Actor, method: 'post' | 'patch', url: string) => ({
  async send(body: Record<string, unknown>) {
    const report = (await as(admin, 'get', url.replace(/\/actions$/, ''))).body.data;
    return as(who, method, url).send({ operationId: randomUUID(), expectedRevision: report.revision, expectedTargetVersion: report.targetVersion, ...body });
  },
});
async function actor(name: string, role: 'ADMIN' | 'MEMBER' | 'APPLICANT' = 'MEMBER', status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
  const user = await prisma.user.create({ data: { fullName: name, email: `${prefix}-${name}@example.test`, role, status } });
  if (role === 'MEMBER') await prisma.memberProfile.create({ data: { userId: user.id, institution: 'Test institute', professionalType: 'Scientist' } });
  const session = await prisma.session.create({ data: { userId: user.id, tokenHash: sha256(`${prefix}-${user.id}`), expiresAt: new Date(Date.now() + 3600000) } });
  const result = { id: user.id, token: signAccessToken({ sub: user.id, sessionId: session.id, role }) }; actors.push(result); return result;
}
async function join(who: Actor = alice, communityId = id) { return as(who, 'post', `/community/communities/${communityId}/join`); }
async function memberId(who: Actor) { return (await prisma.communityMembership.findUniqueOrThrow({ where: { communityId_userId: { communityId: id, userId: who.id } } })).id; }
async function send(who: Actor = alice, content = 'A community message', extra: Record<string, unknown> = {}) {
  return as(who, 'post', `/community/conversations/${conversationId}/messages`).send({ content, ...extra });
}
async function promote() { await join(moderator); await as(admin, 'patch', `/admin/community/members/${await memberId(moderator)}/role`).send({ role: 'MODERATOR' }); }
async function clean() {
  await prisma.community.deleteMany({ where: { slug: { startsWith: prefix } } });
  const files = await prisma.fileObject.findMany({ where: { communityManaged: true, uploaderId: { in: actors.map(a => a.id) } } });
  await prisma.fileObject.deleteMany({ where: { id: { in: files.map(f => f.id) } } });
  await Promise.all(files.map(f => fs.unlink(assertSafePath(f.storageKey)).catch(() => undefined)));
}
beforeAll(async () => {
  admin = await actor('admin', 'ADMIN'); alice = await actor('alice'); bob = await actor('bob'); moderator = await actor('moderator'); outsider = await actor('outsider'); inactive = await actor('inactive', 'MEMBER', 'SUSPENDED'); applicant = await actor('applicant', 'APPLICANT');
});
beforeEach(async () => {
  await clean();
  const created = await as(admin, 'post', '/admin/community/communities').send(payload);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  id = created.body.data.id;
  conversationId = (await as(admin, 'get', `/admin/community/conversations?communityId=${id}`)).body.data.items[0].id;
});
afterAll(async () => {
  await clean();
  await prisma.auditLog.deleteMany({ where: { actorId: { in: actors.map(a => a.id) } } });
  await prisma.user.deleteMany({ where: { id: { in: actors.map(a => a.id) } } });
  await prisma.$disconnect();
});

describe('Community administration and contracts', () => {
  it('creates General, returns live counts, details, options and dashboard', async () => {
    const detail = (await as(admin, 'get', `/admin/community/communities/${id}`)).body.data;
    expect(detail).toMatchObject({ ...payload, memberCount: 1, conversationCount: 1, messageCount: 0, createdByName: 'admin' });
    const options = (await as(admin, 'get', '/admin/community/options')).body.data;
    expect(options.categories).toContain('Clinical');
    const dashboard = await as(admin, 'get', '/admin/community/dashboard');
    expect(dashboard.status).toBe(200); expect(dashboard.body.data.stats.totalCommunities).toBeGreaterThan(0);
    expect((await as(admin, 'get', '/admin/community/conversations')).body.data.items.find((c: { id: string }) => c.id === conversationId).title).toBe('General');
  });
  it('validates fields, slugs, pagination, dates and sort allowlists', async () => {
    expect((await as(admin, 'post', '/admin/community/communities').send({ ...payload, name: ' ' })).status).toBe(422);
    const duplicate = await as(admin, 'post', '/admin/community/communities').send(payload);
    expect(duplicate.status).toBe(409); expect(duplicate.body.errors[0].field).toBe('slug');
    for (const url of ['/admin/community/communities?limit=101', '/admin/community/communities?sort=DROP', '/admin/community/reports?dateFrom=2026-02-31']) expect((await as(admin, 'get', url)).status).toBe(422);
  });
  it('updates, unpublishes, archives, restores and terminally deletes', async () => {
    const updated = await as(admin, 'patch', `/admin/community/communities/${id}`).send({ ...payload, name: 'Updated group' });
    expect(updated.body.data.name).toBe('Updated group'); await join();
    for (const status of ['INACTIVE', 'ARCHIVED']) {
      expect((await as(admin, 'patch', `/admin/community/communities/${id}/status`).send({ status })).status).toBe(200);
      expect((await as(alice, 'get', `/community/communities/${id}`)).status).toBe(404);
      expect((await as(alice, 'get', `/community/conversations/${conversationId}/messages`)).status).toBe(404);
      expect((await as(alice, 'get', '/community/communities/mine')).body.data.items.some((c: { id: string }) => c.id === id)).toBe(false);
      await as(admin, 'patch', `/admin/community/communities/${id}/status`).send({ status: 'ACTIVE' });
    }
    expect((await as(admin, 'delete', `/admin/community/communities/${id}`)).status).toBe(200);
    expect((await as(admin, 'patch', `/admin/community/communities/${id}/status`).send({ status: 'ACTIVE' })).status).toBe(404);
  });
  it('supports more than 100 communities and complete filter options', async () => {
    await prisma.community.createMany({ data: Array.from({ length: 105 }, (_, n) => ({ ...payload, slug: `${prefix}-${n}`, name: `Group ${String(n).padStart(3, '0')}`, category: n === 104 ? 'Rare category' : 'Clinical', createdById: admin.id, visibility: 'PUBLIC' as const, status: 'ACTIVE' as const })) });
    const first = (await as(alice, 'get', `/community/communities?search=Group&limit=100&sort=name:asc`)).body.data;
    const second = (await as(alice, 'get', `/community/communities?search=Group&limit=100&page=2&sort=name:asc`)).body.data;
    expect(first.pagination.total).toBe(105); expect(first.items.length).toBe(100); expect(second.items.length).toBe(5);
    expect(new Set([...first.items, ...second.items].map(c => c.id)).size).toBe(105);
    expect((await as(admin, 'get', '/admin/community/options')).body.data.categories).toContain('Rare category');
    expect((await as(admin, 'get', '/admin/community/communities?category=Rare%20category')).body.data.pagination.total).toBe(1);
  });
});
describe('Membership and scoped moderator authorization', () => {
  it('rejects anonymous, applicants, inactive accounts and unrelated admin access', async () => {
    expect((await request(app).get(`${root}/community/communities`)).status).toBe(401);
    expect((await as(applicant, 'get', '/community/communities')).status).toBe(403);
    expect((await as(inactive, 'get', '/community/communities')).status).toBe(401);
    expect((await as(alice, 'get', '/admin/community/members')).status).toBe(403);
    await promote();
    expect((await as(moderator, 'get', '/admin/members')).status).toBe(403);
    expect((await as(moderator, 'get', '/admin/community/dashboard')).status).toBe(403);
    expect((await as(moderator, 'post', '/admin/community/communities').send({ ...payload, slug: `${prefix}-forbidden` })).status).toBe(403);
  });
  it('requires membership for public chats and omits directory email', async () => {
    expect((await as(bob, 'get', `/community/communities/${id}`)).status).toBe(200);
    expect((await as(bob, 'get', `/community/communities/${id}/members`)).status).toBe(404);
    await join();
    const directory = (await as(alice, 'get', `/community/communities/${id}/members`)).body.data.items;
    expect(directory.some((m: { userId: string }) => m.userId === alice.id)).toBe(true);
    expect(directory.every((m: { email?: string }) => m.email === undefined)).toBe(true);
    const detail = (await as(admin, 'get', `/admin/community/members/${await memberId(alice)}`)).body.data;
    expect(detail.email).toContain(prefix); expect(detail.recentActivity).toEqual([]);
  });
  it('handles private request, cancellation, approval and leaving', async () => {
    await as(admin, 'patch', `/admin/community/communities/${id}`).send({ ...payload, visibility: 'PRIVATE' });
    expect((await as(alice, 'get', '/community/communities?visibility=PRIVATE')).body.data.items.some((c: { id: string }) => c.id === id)).toBe(true);
    expect((await join()).body.data.membershipStatus).toBe('PENDING');
    expect((await as(alice, 'get', `/community/communities/${id}/conversations`)).status).toBe(404);
    expect((await as(alice, 'delete', `/community/communities/${id}/join-request`)).status).toBe(200);
    await join(); await as(admin, 'patch', `/admin/community/members/${await memberId(alice)}/status`).send({ status: 'ACTIVE' });
    expect((await send()).status).toBe(201);
    expect((await as(alice, 'delete', `/community/communities/${id}/membership`)).status).toBe(200);
    expect((await send()).status).toBe(404);
  });
  it('serializes concurrent joins and keeps one membership', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => join()));
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(await prisma.communityMembership.count({ where: { communityId: id, userId: alice.id } })).toBe(1);
  });
  it.each(['REJECTED', 'SUSPENDED', 'BLOCKED'])('cannot bypass %s through join/cancel/leave', async status => {
    await join(); const mid = await memberId(alice);
    expect((await as(admin, 'patch', `/admin/community/members/${mid}/status`).send({ status })).status).toBe(422);
    expect((await as(admin, 'patch', `/admin/community/members/${mid}/status`).send({ status, reason: 'Review decision' })).status).toBe(200);
    expect((await join()).status).toBe(403);
    expect((await as(alice, 'delete', `/community/communities/${id}/membership`)).status).toBe(403);
    expect((await as(alice, 'delete', `/community/communities/${id}/join-request`)).status).toBe(403);
    expect((await send()).status).toBe(404);
  });
  it('allows moderator decisions only for ordinary members in assigned communities', async () => {
    await promote(); await join();
    const mid = await memberId(alice);
    expect((await as(moderator, 'patch', `/admin/community/members/${mid}/status`).send({ status: 'SUSPENDED', reason: 'Review' })).status).toBe(200);
    expect((await as(moderator, 'patch', `/admin/community/members/${mid}/status`).send({ status: 'ACTIVE' })).status).toBe(200);
    expect((await as(moderator, 'patch', `/admin/community/members/${mid}/role`).send({ role: 'MODERATOR' })).status).toBe(403);
    expect((await as(moderator, 'delete', `/admin/community/members/${await memberId(admin)}`).send({ reason: 'No' })).status).toBe(403);
    const second = (await as(admin, 'post', '/admin/community/communities').send({ ...payload, slug: `${prefix}-other` })).body.data;
    expect((await as(moderator, 'get', `/admin/community/communities/${second.id}`)).status).toBe(404);
    expect((await as(moderator, 'get', `/admin/community/conversations?communityId=${second.id}`)).body.data.items).toEqual([]);
    await as(admin, 'patch', `/admin/community/members/${await memberId(moderator)}/role`).send({ role: 'MEMBER' });
    expect((await as(moderator, 'get', '/admin/community/members')).status).toBe(403);
  });
  it('permits joining again after removal and denies protected administrator mutation', async () => {
    await join();
    expect((await as(admin, 'delete', `/admin/community/members/${await memberId(alice)}`).send({ reason: 'Removed' })).status).toBe(200);
    expect((await join()).status).toBe(200);
    expect((await as(admin, 'patch', `/admin/community/members/${await memberId(admin)}/role`).send({ role: 'MODERATOR' })).status).toBe(403);
  });
});
describe('Messages, moderation and protected files', () => {
  beforeEach(async () => { await join(); await join(bob); await promote(); });
  it('supports replies, own edits, per-user read state, pin/hide/restore and tombstones', async () => {
    const message = (await send()).body.data;
    expect((await as(bob, 'patch', `/community/messages/${message.id}`).send({ content: 'stolen' })).status).toBe(404);
    expect((await as(alice, 'patch', `/community/messages/${message.id}`).send({ content: 'updated' })).body.data.content).toBe('updated');
    const reply = (await send(bob, 'reply', { replyToId: message.id })).body.data;
    expect(reply.replyTo.content).toBe('updated');
    await as(moderator, 'patch', `/admin/community/messages/${message.id}`).send({ isPinned: true, isRead: true, isHidden: true });
    const memberRows = (await as(bob, 'get', `/community/conversations/${conversationId}/messages`)).body.data.items;
    expect(memberRows.some((m: { id: string }) => m.id === message.id)).toBe(false); expect(memberRows.find((m: { id: string }) => m.id === reply.id).replyTo).toBeNull();
    const adminRows = (await as(admin, 'get', `/admin/community/conversations/${conversationId}/messages`)).body.data.items;
    expect(adminRows.find((m: { id: string }) => m.id === message.id).isRead).toBe(false);
    await as(moderator, 'patch', `/admin/community/messages/${message.id}`).send({ isHidden: false, isRead: false });
    expect((await as(alice, 'delete', `/community/messages/${message.id}`)).status).toBe(200);
    const after = (await as(bob, 'get', `/community/conversations/${conversationId}/messages`)).body.data.items;
    expect(after.find((m: { id: string }) => m.id === message.id)).toMatchObject({ content: '', isDeleted: true, attachments: [] });
    expect(after.find((m: { id: string }) => m.id === reply.id).replyTo.content).toBe('');
  });
  it('rejects cross-conversation replies and locked sends', async () => {
    const other = await prisma.communityConversation.create({ data: { communityId: id, title: 'Second conversation' } });
    const target = await prisma.communityMessage.create({ data: { conversationId: other.id, senderId: bob.id, content: 'other' } });
    expect((await send(alice, 'invalid reply', { replyToId: target.id })).status).toBe(422);
    expect((await as(moderator, 'patch', `/admin/community/conversations/${conversationId}`).send({ isLocked: true })).status).toBe(200);
    expect((await send()).status).toBe(409);
    expect((await as(admin, 'post', `/admin/community/conversations/${conversationId}/messages`).send({ content: 'admin also locked' })).status).toBe(409);
    await as(moderator, 'patch', `/admin/community/conversations/${conversationId}`).send({ isLocked: false });
    expect((await send()).status).toBe(201);
  });
  it('paginates newest messages without losing older history', async () => {
    await prisma.communityMessage.createMany({ data: Array.from({ length: 125 }, (_, n) => ({ conversationId, senderId: alice.id, content: `Message ${n}`, createdAt: new Date(1700000000000 + n) })) });
    const first = (await as(bob, 'get', `/community/conversations/${conversationId}/messages?limit=100`)).body.data;
    const second = (await as(bob, 'get', `/community/conversations/${conversationId}/messages?limit=100&page=2`)).body.data;
    expect(first.items[99].content).toBe('Message 124'); expect(second.items[0].content).toBe('Message 0');
    expect(new Set([...first.items, ...second.items].map(m => m.id)).size).toBe(125);
  });
  it('records reports, history, warnings and membership moderation', async () => {
    const message = (await send()).body.data;
    expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Needs review' })).status).toBe(201);
    await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Needs review' });
    const listed = (await as(moderator, 'get', '/admin/community/reports?search=Needs%20review')).body.data.items;
    expect(listed.length).toBe(1); const report = listed[0];
    expect((await decisionAs(moderator, 'patch', `/admin/community/reports/${report.id}`).send({ status: 'UNDER_REVIEW' })).body.data.assignedAdminName).toBe('moderator');
    for (const action of ['HIDE_CONTENT', 'RESTORE_CONTENT', 'WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER', 'RESOLVE_REPORT']) {
      const result = await decisionAs(moderator, 'post', `/admin/community/reports/${report.id}/actions`).send({ action, notes: 'Documented decision' });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
    }
    const detail = (await as(moderator, 'get', `/admin/community/reports/${report.id}`)).body.data;
    expect(detail.status).toBe('RESOLVED'); expect(detail.actionHistory.length).toBe(7);
    expect(await prisma.notification.count({ where: { userId: alice.id, type: 'community' } })).toBeGreaterThan(0);
    expect((await decisionAs(moderator, 'patch', `/admin/community/reports/${report.id}`).send({ status: 'DISMISSED' })).status).toBe(422);
    expect((await decisionAs(moderator, 'patch', `/admin/community/reports/${report.id}`).send({ status: 'DISMISSED', resolutionNotes: 'Closed' })).status).toBe(200);
  });
  it('supports member reports and rejects mismatched communities', async () => {
    const mid = await memberId(alice);
    expect((await as(bob, 'post', `/community/members/${mid}/report`).send({ submissionId: randomUUID(), communityId: 'wrong', reason: 'Review' })).status).toBe(404);
    expect((await as(bob, 'post', `/community/members/${mid}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Review' })).status).toBe(201);
  });
  it('reports administrator messages without creating a membership and deduplicates concurrently', async () => {
    const author = await actor('second-administrator', 'ADMIN');
    const sent = await as(author, 'post', `/admin/community/conversations/${conversationId}/messages`).send({ content: 'Administrator announcement' });
    expect(sent.status).toBe(201);
    const messageId = sent.body.data.id;
    const responses = await Promise.all([1, 2].map(() => as(bob, 'post', `/community/messages/${messageId}/report`).send({ submissionId: randomUUID(), reason: 'Review administrator message' })));
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    const rows = (await as(admin, 'get', '/admin/community/reports?search=second-administrator')).body.data.items;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reportedMemberName: 'second-administrator', reportedMessage: { id: messageId }, availableActions: ['HIDE_CONTENT', 'RESOLVE_REPORT', 'DISMISS_REPORT'] });
    expect(rows[0].reportedMemberId).toBeUndefined();
    expect(await prisma.communityMembership.count({ where: { communityId: id, userId: author.id } })).toBe(0);
    expect((await as(author, 'post', `/community/messages/${messageId}/report`).send({ submissionId: randomUUID(), reason: 'Own message' })).status).toBe(422);
    expect((await decisionAs(admin, 'post', `/admin/community/reports/${rows[0].id}/actions`).send({ action: 'WARN_MEMBER', notes: 'Unavailable' })).status).toBe(409);
  });
  it('accepts direct member reports only for visible directory members', async () => {
    const mid = await memberId(alice);
    for (const status of ['PENDING', 'REJECTED', 'SUSPENDED', 'BLOCKED'] as const) {
      await prisma.communityMembership.update({ where: { id: mid }, data: { status } });
      expect((await as(bob, 'post', `/community/members/${mid}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Invisible member' })).status).toBe(404);
    }
    await prisma.communityMembership.update({ where: { id: mid }, data: { status: 'ACTIVE', removedAt: new Date() } });
    expect((await as(bob, 'post', `/community/members/${mid}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Removed member' })).status).toBe(404);
    const inactiveMembership = await prisma.communityMembership.create({ data: { communityId: id, userId: inactive.id, status: 'ACTIVE' } });
    expect((await as(bob, 'post', `/community/members/${inactiveMembership.id}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Inactive account' })).status).toBe(404);
    expect(await prisma.communityReport.count({ where: { communityId: id } })).toBe(0);
  });
  it('keeps historical messages reportable after their authors leave', async () => {
    const message = (await send()).body.data;
    await as(alice, 'delete', `/community/communities/${id}/membership`);
    expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Historical message' })).status).toBe(201);
    const report = (await as(admin, 'get', '/admin/community/reports?search=Historical')).body.data.items[0];
    expect(report.reportedMemberName).toBe('alice');
    expect(report.availableActions).toEqual(['HIDE_CONTENT', 'RESOLVE_REPORT', 'DISMISS_REPORT']);
    expect((await decisionAs(admin, 'post', `/admin/community/reports/${report.id}/actions`).send({ action: 'HIDE_CONTENT', notes: 'Hidden after departure' })).status).toBe(200);
  });
  it('offers and enforces actions for the current actor and target', async () => {
    const mid = await memberId(alice);
    await as(bob, 'post', `/community/members/${mid}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Member eligibility' });
    const report = (await as(admin, 'get', '/admin/community/reports?search=Member%20eligibility')).body.data.items[0];
    expect(report.availableActions).toEqual(['WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER', 'RESOLVE_REPORT', 'DISMISS_REPORT']);
    expect((await decisionAs(admin, 'post', `/admin/community/reports/${report.id}/actions`).send({ action: 'HIDE_CONTENT', notes: 'No message' })).status).toBe(409);
    await as(admin, 'patch', `/admin/community/members/${mid}/role`).send({ role: 'MODERATOR' });
    expect((await as(moderator, 'get', `/admin/community/reports/${report.id}`)).body.data.availableActions).toEqual(['RESOLVE_REPORT', 'DISMISS_REPORT']);
    expect((await decisionAs(moderator, 'post', `/admin/community/reports/${report.id}/actions`).send({ action: 'BLOCK_MEMBER', notes: 'Protected target' })).status).toBe(409);
    expect((await as(alice, 'get', `/admin/community/reports/${report.id}`)).body.data.availableActions).toEqual(['RESOLVE_REPORT', 'DISMISS_REPORT']);
    expect((await as(admin, 'get', `/admin/community/reports/${report.id}`)).body.data.availableActions).toContain('BLOCK_MEMBER');
    expect(await prisma.communityModerationAction.count({ where: { reportId: report.id } })).toBe(0);
    await as(admin, 'patch', `/admin/community/members/${await memberId(moderator)}/role`).send({ role: 'MEMBER' });
    expect((await as(moderator, 'get', `/admin/community/reports/${report.id}`)).status).toBe(403);
    expect((await decisionAs(moderator, 'post', `/admin/community/reports/${report.id}/actions`).send({ action: 'RESOLVE_REPORT', notes: 'Revoked' })).status).toBe(403);
  });
  it('starts review once and preserves the reviewer across duplicate requests', async () => {
    const message = (await send()).body.data;
    await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Review once' });
    const report = await prisma.communityReport.findFirstOrThrow({ where: { reportedMessageId: message.id } });
    const url = `/admin/community/reports/${report.id}`;
    const current = (await as(moderator, 'get', url)).body.data;
    const body = { status: 'UNDER_REVIEW', operationId: randomUUID(), expectedRevision: current.revision, expectedTargetVersion: current.targetVersion };
    const responses = await Promise.all([1, 2].map(() => as(moderator, 'patch', url).send(body)));
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    const duplicate = (await decisionAs(admin, 'patch', url).send({ status: 'UNDER_REVIEW' })).body.data;
    expect(duplicate.assignedAdminName).toBe('moderator'); expect(duplicate.actionHistory).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entity: report.id, action: 'CommunityREPORT_UNDER_REVIEW' } })).toBe(1);
  });
  it('allows documented corrections on closed reports and clears stale resolution notes on reopening', async () => {
    const message = (await send()).body.data;
    await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Correctable report' });
    const report = await prisma.communityReport.findFirstOrThrow({ where: { reportedMessageId: message.id } });
    const url = `/admin/community/reports/${report.id}`;
    await decisionAs(admin, 'patch', url).send({ status: 'RESOLVED', resolutionNotes: 'Original resolution' });
    const corrected = (await decisionAs(moderator, 'post', `${url}/actions`).send({ action: 'HIDE_CONTENT', notes: 'Correction after closing' })).body.data;
    expect(corrected).toMatchObject({ status: 'RESOLVED', resolutionNotes: 'Original resolution', assignedAdminName: 'moderator' });
    expect(corrected.availableActions).toContain('RESTORE_CONTENT'); expect(corrected.availableActions).not.toContain('HIDE_CONTENT');
    expect((await decisionAs(admin, 'post', `${url}/actions`).send({ action: 'HIDE_CONTENT', notes: 'Stale modal' })).status).toBe(409);
    const opened = (await decisionAs(admin, 'patch', url).send({ status: 'OPEN' })).body.data;
    expect(opened.resolutionNotes).toBeUndefined(); expect(opened.actionHistory.at(-1).notes).toBe('Report reopened.');
    await decisionAs(admin, 'post', `${url}/actions`).send({ action: 'DISMISS_REPORT', notes: 'Dismissed with notes' });
    expect((await decisionAs(moderator, 'patch', url).send({ status: 'UNDER_REVIEW' })).status).toBe(409);
    await decisionAs(moderator, 'post', `${url}/actions`).send({ action: 'REOPEN_REPORT', notes: 'Reopen explicitly' });
    const reviewed = (await decisionAs(moderator, 'patch', url).send({ status: 'UNDER_REVIEW' })).body.data;
    expect(reviewed.resolutionNotes).toBeUndefined(); expect(reviewed.actionHistory.at(-1).notes).toBe('Review started.');
    expect((await prisma.communityReport.findUniqueOrThrow({ where: { id: report.id } })).resolutionNotes).toBeNull();
  });
  it('rolls back target changes, notifications and history when audit persistence fails', async () => {
    const message = (await send()).body.data;
    await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Atomic moderation' });
    const report = await prisma.communityReport.findFirstOrThrow({ where: { reportedMessageId: message.id } });
    const notifications = await prisma.notification.count({ where: { userId: alice.id } });
    for (const action of ['HIDE_CONTENT', 'WARN_MEMBER', 'SUSPEND_MEMBER', 'RESOLVE_REPORT']) {
      const failingAudit = vi.spyOn(communityAccess, 'audit').mockRejectedValueOnce(new Error('Injected audit failure'));
      try { expect((await decisionAs(admin, 'post', `/admin/community/reports/${report.id}/actions`).send({ action, notes: 'Should roll back' })).status).toBe(500); }
      finally { failingAudit.mockRestore(); }
      expect((await prisma.communityMessage.findUniqueOrThrow({ where: { id: message.id } })).isHidden).toBe(false);
      expect((await prisma.communityMembership.findUniqueOrThrow({ where: { id: await memberId(alice) } })).status).toBe('ACTIVE');
      expect(await prisma.notification.count({ where: { userId: alice.id } })).toBe(notifications);
      expect(await prisma.communityModerationAction.count({ where: { reportId: report.id } })).toBe(0);
      expect(await prisma.communityReportOperation.count({ where: { reportId: report.id } })).toBe(0);
      expect(await prisma.communityReport.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({ status: 'OPEN', assignedAdminId: null, resolutionNotes: null });
    }
  });
  it('filters reports and clamps pagination when the final filtered page is resolved', async () => {
    const targetId = await memberId(alice);
    await prisma.communityReport.createMany({ data: Array.from({ length: 12 }, (_, n) => ({ communityId: id, reporterId: bob.id, reportedMemberId: targetId, reason: `Pagination report ${n}`, createdAt: new Date(`2020-01-01T00:00:${String(n).padStart(2, '0')}.000Z`) })) });
    const url = `/admin/community/reports?communityId=${id}&status=OPEN&search=Pagination&limit=10&page=2`;
    const second = (await as(admin, 'get', url)).body.data;
    expect(second.pagination).toMatchObject({ page: 2, pages: 2, total: 12 });
    expect(second.items).toHaveLength(2);
    for (const report of second.items) await decisionAs(admin, 'patch', `/admin/community/reports/${report.id}`).send({ status: 'RESOLVED', resolutionNotes: 'Cleared filtered page' });
    const clamped = (await as(admin, 'get', url)).body.data;
    expect(clamped.pagination).toMatchObject({ page: 1, pages: 1, total: 10 }); expect(clamped.items).toHaveLength(10);
    expect((await as(admin, 'get', `/admin/community/reports?communityId=${id}&status=RESOLVED`)).body.data.pagination.total).toBe(2);
    expect((await as(admin, 'get', `/admin/community/reports?communityId=${id}&dateFrom=2020-01-02`)).body.data.pagination.total).toBe(0);
    expect((await as(admin, 'get', `/admin/community/reports?communityId=${id}&dateFrom=2020-01-01&search=Pagination%20report%2011`)).body.data.pagination.total).toBe(1);
  });
  it('returns safe report tombstones and revokes attachment access after deletion', async () => {
    const uploaded = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Reported attachment').attach('attachments', Buffer.from('Report evidence'), { filename: 'evidence.txt', contentType: 'text/plain' });
    const message = uploaded.body.data;
    await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Attachment review' });
    const report = await prisma.communityReport.findFirstOrThrow({ where: { reportedMessageId: message.id } });
    const url = `/admin/community/reports/${report.id}`;
    const hidden = (await decisionAs(moderator, 'post', `${url}/actions`).send({ action: 'HIDE_CONTENT', notes: 'Review attachment' })).body.data;
    expect(hidden.reportedMessage.attachments).toHaveLength(1);
    expect((await as(bob, 'get', message.attachments[0].fileUrl)).status).toBe(404);
    expect((await as(moderator, 'get', message.attachments[0].fileUrl)).status).toBe(200);
    expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Hidden content' })).status).toBe(404);
    await as(admin, 'delete', `/admin/community/messages/${message.id}`);
    for (const data of [(await as(admin, 'get', url)).body.data, (await as(admin, 'get', '/admin/community/reports?search=Attachment%20review')).body.data.items[0]]) {
      expect(data.reportedMessage).toMatchObject({ isDeleted: true, content: '', attachments: [] });
      expect(data.availableActions).not.toContain('RESTORE_CONTENT'); expect(data.availableActions).not.toContain('HIDE_CONTENT');
    }
    expect((await as(admin, 'get', message.attachments[0].fileUrl)).status).toBe(404);
  });
  it('preserves immutable reply evidence and retained files through edits and deletion', async () => {
    const parent = (await send(alice, 'Parent message')).body.data;
    const uploaded = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Original reply').field('replyToId', parent.id).attach('attachments', Buffer.from('Immutable bytes'), { filename: 'original.txt', contentType: 'text/plain' });
    const message = uploaded.body.data;
    const submitted = await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Reply evidence' });
    const url = `/admin/community/reports/${submitted.body.data.reportId}`;
    const original = (await as(admin, 'get', url)).body.data;
    expect(original.evidence.message).toMatchObject({ content: 'Original reply', replyToId: parent.id, author: { id: alice.id }, conversation: { id: conversationId } });
    await as(alice, 'patch', `/community/messages/${message.id}`).send({ content: 'Edited reply' });
    const edited = (await as(admin, 'get', url)).body.data;
    expect(edited.evidence).toEqual(original.evidence); expect(edited.reportedMessage.content).toBe('Edited reply');
    expect(edited.targetVersion).not.toBe(original.targetVersion);
    await as(alice, 'delete', `/community/messages/${message.id}`);
    const attachmentId = original.evidence.attachments[0].id;
    const evidenceUrl = `${url}/evidence/${attachmentId}`;
    expect((await as(moderator, 'get', evidenceUrl)).text).toBe('Immutable bytes');
    expect((await as(admin, 'get', evidenceUrl)).headers['cache-control']).toBe('private, no-store');
    expect((await request(app).get(`${root}${evidenceUrl}`)).status).toBe(401);
    for (const who of [alice, bob, outsider]) expect((await as(who, 'get', evidenceUrl)).status).toBe(403);
    expect((await as(admin, 'get', message.attachments[0].fileUrl)).status).toBe(404);
    expect((await as(admin, 'get', url)).body.data.evidence).toEqual(original.evidence);
    const other = (await as(admin, 'post', '/admin/community/communities').send({ ...payload, slug: `${prefix}-other-evidence` })).body.data;
    await join(outsider, other.id);
    const otherMembership = await prisma.communityMembership.findUniqueOrThrow({ where: { communityId_userId: { communityId: other.id, userId: outsider.id } } });
    await as(admin, 'patch', `/admin/community/members/${otherMembership.id}/role`).send({ role: 'MODERATOR' });
    expect((await as(outsider, 'get', evidenceUrl)).status).toBe(404);
    // Even a hard deletion of the message cannot release retained evidence bytes.
    await prisma.communityMessage.delete({ where: { id: message.id } });
    const reference = await prisma.communityReportEvidence.findFirstOrThrow({ where: { reportId: original.id } });
    await expect(prisma.fileObject.delete({ where: { id: reference.fileId } })).rejects.toThrow();
    expect((await as(admin, 'get', evidenceUrl)).text).toBe('Immutable bytes');
    await as(admin, 'patch', `/admin/community/members/${await memberId(moderator)}/role`).send({ role: 'MEMBER' });
    expect((await as(moderator, 'get', evidenceUrl)).status).toBe(403);
  });
  it('returns stable submission receipts after closure and rejects reused keys with different input', async () => {
    const message = (await send()).body.data;
    const url = `/community/messages/${message.id}/report`;
    const body = { submissionId: randomUUID(), reason: 'Reliable submission' };
    const created = (await as(bob, 'post', url).send(body)).body.data;
    expect(created).toMatchObject({ created: true, duplicate: false, status: 'OPEN' });
    expect((await as(bob, 'post', url).send(body)).body.data).toEqual(created);
    const duplicateBody = { ...body, submissionId: randomUUID() };
    expect((await as(bob, 'post', url).send(duplicateBody)).body.data).toMatchObject({ reportId: created.reportId, created: false, duplicate: true });
    await decisionAs(admin, 'post', `/admin/community/reports/${created.reportId}/actions`).send({ action: 'RESOLVE_REPORT', notes: 'Closed' });
    await as(admin, 'delete', `/admin/community/messages/${message.id}`);
    expect((await as(bob, 'post', url).send(body)).body.data).toMatchObject({ reportId: created.reportId, status: 'RESOLVED', created: true });
    expect((await as(bob, 'post', url).send(duplicateBody)).body.data).toMatchObject({ reportId: created.reportId, created: false });
    expect((await as(bob, 'post', url).send({ ...body, reason: 'Changed input' })).status).toBe(409);
    expect(await prisma.communityReport.count({ where: { reportedMessageId: message.id } })).toBe(1);
  });
  it('checks mutation preconditions and serializes concurrent reviewers without duplicate warnings', async () => {
    const message = (await send()).body.data;
    const created = (await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Concurrent review' })).body.data;
    const url = `/admin/community/reports/${created.reportId}`;
    const report = (await as(admin, 'get', url)).body.data;
    const body = { action: 'WARN_MEMBER', notes: 'One warning', operationId: randomUUID(), expectedRevision: report.revision, expectedTargetVersion: report.targetVersion };
    const before = await prisma.notification.count({ where: { userId: alice.id } });
    const responses = await Promise.all([as(admin, 'post', `${url}/actions`).send(body), as(moderator, 'post', `${url}/actions`).send({ ...body, operationId: randomUUID() })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? admin : moderator;
    // The first operation is retried only if it won; otherwise use its own conflict to prove it didn't run.
    if (winner === admin) {
      expect((await as(admin, 'post', `${url}/actions`).send(body)).status).toBe(200);
      expect((await as(admin, 'post', `${url}/actions`).send({ ...body, notes: 'Changed warning' })).status).toBe(409);
    }
    expect(await prisma.notification.count({ where: { userId: alice.id } })).toBe(before + 1);
    const current = (await as(admin, 'get', url)).body.data;
    expect(current).toMatchObject({ status: 'UNDER_REVIEW', revision: 1 }); expect(current.actionHistory).toHaveLength(1);
    expect((await as(admin, 'post', `${url}/actions`).send({ action: 'WARN_MEMBER', notes: 'Missing preconditions' })).status).toBe(422);
    expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send({ reason: 'Missing submission ID' })).status).toBe(422);
  });
  it('replays identical warnings safely and rejects changes to content or membership after review', async () => {
    const message = (await send()).body.data;
    const created = (await as(bob, 'post', `/community/messages/${message.id}/report`).send({ submissionId: randomUUID(), reason: 'Target versions' })).body.data;
    const url = `/admin/community/reports/${created.reportId}`;
    const report = (await as(admin, 'get', url)).body.data;
    const body = { action: 'WARN_MEMBER', notes: 'Exactly once', operationId: randomUUID(), expectedRevision: report.revision, expectedTargetVersion: report.targetVersion };
    const before = await prisma.notification.count({ where: { userId: alice.id } });
    const retries = await Promise.all([1, 2, 3].map(() => as(admin, 'post', `${url}/actions`).send(body)));
    expect(retries.map(r => r.status)).toEqual([200, 200, 200]);
    expect(await prisma.notification.count({ where: { userId: alice.id } })).toBe(before + 1);
    const current = (await as(admin, 'get', url)).body.data;
    await as(alice, 'patch', `/community/messages/${message.id}`).send({ content: 'Changed after review' });
    expect((await as(admin, 'post', `${url}/actions`).send({ ...body, operationId: randomUUID(), expectedRevision: current.revision, expectedTargetVersion: current.targetVersion })).status).toBe(409);
    const edited = (await as(admin, 'get', url)).body.data;
    await as(admin, 'patch', `/admin/community/members/${await memberId(alice)}/status`).send({ status: 'BLOCKED', reason: 'Membership action' });
    expect((await as(admin, 'post', `${url}/actions`).send({ ...body, action: 'SUSPEND_MEMBER', operationId: randomUUID(), expectedRevision: edited.revision, expectedTargetVersion: edited.targetVersion })).status).toBe(409);
    const blocked = (await as(admin, 'get', url)).body.data;
    expect(blocked.availableActions).not.toContain('SUSPEND_MEMBER'); expect(blocked.availableActions).not.toContain('BLOCK_MEMBER');
    expect((await decisionAs(admin, 'post', `${url}/actions`).send({ action: 'SUSPEND_MEMBER', notes: 'Never downgrade block' })).status).toBe(409);
    expect((await prisma.communityMembership.findUniqueOrThrow({ where: { id: await memberId(alice) } })).status).toBe('BLOCKED');
  });
  it('rolls back new evidence and submission receipts when creation fails', async () => {
    const message = (await send()).body.data;
    const body = { submissionId: randomUUID(), reason: 'Atomic evidence creation' };
    const failingAudit = vi.spyOn(communityAccess, 'audit').mockRejectedValueOnce(new Error('Injected report audit failure'));
    try { expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send(body)).status).toBe(500); }
    finally { failingAudit.mockRestore(); }
    expect(await prisma.communityReport.count({ where: { reportedMessageId: message.id } })).toBe(0);
    expect(await prisma.communityReportSubmission.count({ where: { submissionId: body.submissionId } })).toBe(0);
    expect((await as(bob, 'post', `/community/messages/${message.id}/report`).send(body)).body.data.created).toBe(true);
  });
  it('leaves legacy evidence unavailable and captures member identity only at submission', async () => {
    const legacy = await prisma.communityReport.create({ data: { communityId: id, reporterId: bob.id, reason: 'Legacy report' } });
    expect((await as(admin, 'get', `/admin/community/reports/${legacy.id}`)).body.data.evidence).toBeNull();
    const receipt = (await as(bob, 'post', `/community/members/${await memberId(alice)}/report`).send({ submissionId: randomUUID(), communityId: id, reason: 'Member snapshot' })).body.data;
    const url = `/admin/community/reports/${receipt.reportId}`;
    const original = (await as(admin, 'get', url)).body.data.evidence;
    expect(original).toMatchObject({ kind: 'member', message: null, member: { user: { id: alice.id, fullName: 'alice' }, status: 'ACTIVE', role: 'MEMBER' } });
    await decisionAs(admin, 'post', `${url}/actions`).send({ action: 'BLOCK_MEMBER', notes: 'Restrict member' });
    expect((await as(admin, 'get', url)).body.data.evidence).toEqual(original);
  });
  it('validates uploaded bytes and revokes file access even for uploaders', async () => {
    const upload = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Attached PDF').attach('attachments', Buffer.from('%PDF-1.7\nExample'), { filename: 'example.pdf', contentType: 'application/pdf' });
    expect(upload.status, JSON.stringify(upload.body)).toBe(201); const message = upload.body.data, file = message.attachments[0];
    expect((await as(bob, 'get', file.fileUrl)).status).toBe(200);
    expect((await as(outsider, 'get', file.fileUrl)).status).toBe(404);
    await as(moderator, 'patch', `/admin/community/messages/${message.id}`).send({ isHidden: true });
    expect((await as(alice, 'get', file.fileUrl)).status).toBe(404);
    expect((await as(moderator, 'get', file.fileUrl)).status).toBe(200);
    await as(moderator, 'patch', `/admin/community/messages/${message.id}`).send({ isHidden: false });
    await as(admin, 'patch', `/admin/community/members/${await memberId(alice)}/status`).send({ status: 'SUSPENDED', reason: 'Review' });
    expect((await as(alice, 'get', file.fileUrl)).status).toBe(404);
    expect((await as(bob, 'get', file.fileUrl)).headers['cache-control']).toBe('private, no-store');
    await as(admin, 'delete', `/admin/community/messages/${message.id}`);
    expect((await as(admin, 'get', file.fileUrl)).status).toBe(404);
  });
  it('rejects empty, spoofed, unsupported, excess and missing-text attachments without saving files', async () => {
    const before = await prisma.fileObject.count({ where: { communityManaged: true } });
    for (const [name, content, type] of [['bad.png', 'not PNG', 'image/png'], ['bad.html', '<script/>', 'text/html'], ['empty.txt', '', 'text/plain']]) {
      const response = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'File').attach('attachments', Buffer.from(content!), { filename: name!, contentType: type! });
      expect(response.status).toBe(422);
    }
    expect((await as(alice, 'post', `/community/conversations/${conversationId}/messages`).attach('attachments', Buffer.from('text'), 'test.txt')).status).toBe(422);
    let excessive = as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'too many');
    for (let n = 0; n < 6; n++) excessive = excessive.attach('attachments', Buffer.from('text'), `test${n}.txt`);
    expect((await excessive).status).toBe(422);
    expect(await prisma.fileObject.count({ where: { communityManaged: true } })).toBe(before);
  });
  it('cleans staged files on oversized uploads and failed database commits', async () => {
    const before = new Set(await fs.readdir(uploadRoot));
    const oversized = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Too big')
      .attach('attachments', Buffer.alloc(env.MAX_UPLOAD_MB * 1024 * 1024 + 1, 65), { filename: 'big.txt', contentType: 'text/plain' });
    expect(oversized.status).toBe(422);
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Test database write failure'));
    try {
      const failure = await as(alice, 'post', `/community/conversations/${conversationId}/messages`).field('content', 'Should not persist')
        .attach('attachments', Buffer.from('Test text'), { filename: 'failed.txt', contentType: 'text/plain' });
      expect(failure.status).toBe(500);
    } finally { transaction.mockRestore(); }
    await vi.waitFor(async () => expect((await fs.readdir(uploadRoot)).filter(name => !before.has(name))).toEqual([]));
    expect(await prisma.communityMessage.count({ where: { conversationId, content: 'Should not persist' } })).toBe(0);
  });
  it('uploads community images and protects inactive assets', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64');
    let update = as(admin, 'patch', `/admin/community/communities/${id}`);
    for (const [key, value] of Object.entries(payload)) update = update.field(key, value);
    const response = await update.attach('image', png, { filename: 'image.png', contentType: 'image/png' }).attach('banner', png, { filename: 'banner.png', contentType: 'image/png' });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const url = response.body.data.imageUrl;
    expect((await as(outsider, 'get', url)).status).toBe(200);
    await as(admin, 'patch', `/admin/community/communities/${id}/status`).send({ status: 'INACTIVE' });
    expect((await as(outsider, 'get', url)).status).toBe(404);
  });
});
