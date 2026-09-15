import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Nothing in these tests should send mail; stubbed so the suite never touches SMTP.
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async () => undefined),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async () => undefined),
}));

import { createApp } from '../app';
import { prisma } from '../config/database';
import { sha256, signAccessToken } from '../utils/security';

/**
 * The member community surface: directory, connections, interest groups,
 * discussions and member-to-member messages.
 *
 * The case that matters most is the last one — a direct message must reach the
 * other member and must not reach the CRO queue.
 */
const app = createApp();
const PREFIX = 'member-community-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

interface Actor { userId: string; profileId: string; token: string }

let alice: Actor;
let bob: Actor;
let adminToken: string;

async function makeMember(key: string, opts: { role?: 'MEMBER' | 'ADMIN'; status?: 'ACTIVE' | 'PENDING'; country?: string; institution?: string; interests?: string[] } = {}) {
  const role = opts.role ?? 'MEMBER';
  const user = await prisma.user.create({
    data: {
      email: email(key),
      passwordHash: null,
      fullName: `${PREFIX} ${key}`,
      role,
      status: opts.status ?? 'ACTIVE',
      lastLoginAt: new Date(),
    },
  });
  const profile = role === 'ADMIN' ? null : await prisma.memberProfile.create({
    data: {
      userId: user.id,
      professionalType: 'Research Scholar / Scientist',
      institution: opts.institution ?? `${PREFIX} Institute`,
      country: opts.country ?? 'Testland',
      approvedAt: new Date(),
      ...(opts.interests?.length ? { interests: { create: opts.interests.map((name) => ({ name })) } } : {}),
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: sha256(`${PREFIX}-${user.id}-${Date.now()}-${Math.random()}`),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return { userId: user.id, profileId: profile?.id ?? '', token: signAccessToken({ sub: user.id, sessionId: session.id, role }) };
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    // Conversations are not owned by a user, so clear the ones we created.
    const convos = await prisma.conversation.findMany({
      where: { participants: { some: { userId: { in: ids } } } },
      select: { id: true },
    });
    if (convos.length) {
      const convoIds = convos.map((c) => c.id);
      await prisma.message.deleteMany({ where: { conversationId: { in: convoIds } } });
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: { in: convoIds } } });
      await prisma.conversation.deleteMany({ where: { id: { in: convoIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.discussionThread.deleteMany({ where: { title: { startsWith: PREFIX } } });
  await prisma.interestGroup.deleteMany({ where: { name: { startsWith: PREFIX } } });
}

beforeAll(wipe);

beforeEach(async () => {
  await wipe();
  alice = await makeMember('alice', { country: 'Testland', interests: ['Neuroimaging'] });
  bob = await makeMember('bob', { country: 'Otherland', institution: `${PREFIX} Other Institute` });
  adminToken = (await makeMember('admin', { role: 'ADMIN' })).token;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const as = (actor: Actor | string, method: 'get' | 'post' | 'delete', url: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${typeof actor === 'string' ? actor : actor.token}`);

/** Only this suite's fixtures — the database also holds seeded members. */
const ours = (rows: { name: string }[]) => rows.filter((r) => r.name.startsWith(PREFIX));

describe('GET /api/v1/members/me/community', () => {
  it('rejects an unauthenticated caller', async () => {
    expect((await request(app).get('/api/v1/members/me/community')).status).toBe(401);
  });

  it('lists other active members but never the caller', async () => {
    const response = await as(alice, 'get', '/api/v1/members/me/community');

    expect(response.status).toBe(200);
    const names = ours(response.body.data.members.items).map((m: { name: string }) => m.name);
    expect(names).toContain(`${PREFIX} bob`);
    expect(names).not.toContain(`${PREFIX} alice`);
  });

  it('excludes applicants and non-members', async () => {
    await makeMember('pending', { status: 'PENDING' });

    const names = ours((await as(alice, 'get', '/api/v1/members/me/community')).body.data.members.items)
      .map((m: { name: string }) => m.name);

    expect(names).not.toContain(`${PREFIX} pending`);
    expect(names).not.toContain(`${PREFIX} admin`);
  });

  it('counts only the rows a search actually returns', async () => {
    const response = await as(alice, 'get', `/api/v1/members/me/community?q=${PREFIX}%20Other%20Institute`);

    // The previous implementation counted the whole table, so `pages` described
    // a result set the directory was not showing.
    expect(response.body.data.members.items).toHaveLength(1);
    expect(response.body.data.members.pagination.total).toBe(1);
  });

  it('reports real project and publication counts', async () => {
    await prisma.project.create({
      data: { ownerId: bob.userId, title: `${PREFIX} project`, category: 'Neuroscience', description: 'A long enough description for the record.' },
    });

    const row = ours((await as(alice, 'get', '/api/v1/members/me/community')).body.data.members.items)
      .find((m: { name: string }) => m.name === `${PREFIX} bob`);

    expect(row.projects).toBe(1);
    expect(row.pubs).toBe(0);
  });

  it('returns stats and addressable ids for groups and threads', async () => {
    await prisma.interestGroup.create({ data: { name: `${PREFIX} group`, tag: 'Active' } });
    await prisma.discussionThread.create({ data: { title: `${PREFIX} thread`, category: 'General', authorId: bob.userId } });

    const data = (await as(alice, 'get', '/api/v1/members/me/community')).body.data;

    expect(data.stats.totalMembers).toBeGreaterThanOrEqual(2);
    expect(data.stats).toHaveProperty('countries');
    expect(data.stats).toHaveProperty('online');
    // Without ids the page cannot address a group or a thread at all.
    expect(data.groups.every((g: { id: string }) => Boolean(g.id))).toBe(true);
    const thread = data.threads.find((t: { title: string }) => t.title === `${PREFIX} thread`);
    expect(thread.id).toBeTruthy();
    expect(thread.author).toBe(`${PREFIX} bob`);
  });
});

describe('connections', () => {
  const connect = (actor: Actor, profileId: string) =>
    as(actor, 'post', '/api/v1/members/me/community/connections').send({ profileId });

  it('records a request as pending, and shows it to both sides correctly', async () => {
    const response = await connect(alice, bob.profileId);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('requested');

    const fromAlice = ours((await as(alice, 'get', '/api/v1/members/me/community')).body.data.members.items)[0];
    expect(fromAlice.connectionStatus).toBe('requested');

    // Bob sees the same pending state — there is no inbox, so it reads the same way.
    const fromBob = ours((await as(bob, 'get', '/api/v1/members/me/community')).body.data.members.items)[0];
    expect(fromBob.connectionStatus).toBe('requested');
  });

  it('completes the connection when the other member asks back', async () => {
    await connect(alice, bob.profileId);
    const response = await connect(bob, alice.profileId);

    expect(response.body.data.status).toBe('connected');
    // Still one row: the reverse request accepts rather than duplicating.
    expect(await prisma.memberConnection.count({ where: { requesterId: alice.profileId } })).toBe(1);
    expect(await prisma.memberConnection.count({ where: { requesterId: bob.profileId } })).toBe(0);

    for (const actor of [alice, bob]) {
      const row = ours((await as(actor, 'get', '/api/v1/members/me/community')).body.data.members.items)[0];
      expect(row.connectionStatus).toBe('connected');
    }
  });

  it('refuses a duplicate request from the same side', async () => {
    await connect(alice, bob.profileId);
    expect((await connect(alice, bob.profileId)).status).toBe(409);
  });

  it('refuses connecting to yourself', async () => {
    expect((await connect(alice, alice.profileId)).status).toBe(422);
  });

  it('removes a connection from either direction', async () => {
    await connect(alice, bob.profileId);

    // Bob removes a request Alice sent.
    const response = await as(bob, 'delete', `/api/v1/members/me/community/connections/${alice.profileId}`);

    expect(response.status).toBe(200);
    expect(await prisma.memberConnection.count()).toBe(0);
  });

  it('404s removing a connection that does not exist', async () => {
    expect((await as(alice, 'delete', `/api/v1/members/me/community/connections/${bob.profileId}`)).status).toBe(404);
  });
});

describe('interest groups', () => {
  let groupId: string;

  beforeEach(async () => {
    groupId = (await prisma.interestGroup.create({ data: { name: `${PREFIX} group`, tag: 'Active' } })).id;
  });

  it('joins, reflects membership, and leaves', async () => {
    expect((await as(alice, 'post', `/api/v1/members/me/community/groups/${groupId}/join`)).status).toBe(200);

    const joined = (await as(alice, 'get', '/api/v1/members/me/community')).body.data.groups
      .find((g: { id: string }) => g.id === groupId);
    expect(joined.joined).toBe(true);
    expect(joined.members).toBe(1);

    // Bob is in the same group listing but has not joined it.
    const forBob = (await as(bob, 'get', '/api/v1/members/me/community')).body.data.groups
      .find((g: { id: string }) => g.id === groupId);
    expect(forBob.joined).toBe(false);

    expect((await as(alice, 'delete', `/api/v1/members/me/community/groups/${groupId}/join`)).status).toBe(200);
    expect(await prisma.interestGroupMember.count({ where: { groupId } })).toBe(0);
  });

  it('is idempotent on a second join', async () => {
    await as(alice, 'post', `/api/v1/members/me/community/groups/${groupId}/join`);
    expect((await as(alice, 'post', `/api/v1/members/me/community/groups/${groupId}/join`)).status).toBe(200);
    expect(await prisma.interestGroupMember.count({ where: { groupId } })).toBe(1);
  });

  it('404s an unknown group and 404s leaving one you are not in', async () => {
    expect((await as(alice, 'post', '/api/v1/members/me/community/groups/nope/join')).status).toBe(404);
    expect((await as(alice, 'delete', `/api/v1/members/me/community/groups/${groupId}/join`)).status).toBe(404);
  });
});

describe('discussions', () => {
  it('starts a thread attributed to its author and returns it in the list', async () => {
    const created = await as(alice, 'post', '/api/v1/members/me/community/threads')
      .send({ title: `${PREFIX} a brand new discussion` });

    expect(created.status).toBe(201);
    const listed = (await as(bob, 'get', '/api/v1/members/me/community')).body.data.threads
      .find((t: { id: string }) => t.id === created.body.data.id);
    expect(listed.author).toBe(`${PREFIX} alice`);
    expect(listed.replies).toBe(0);
  });

  it('refuses a title that is too short, and says how short', async () => {
    const response = await as(alice, 'post', '/api/v1/members/me/community/threads').send({ title: 'hi' });

    expect(response.status).toBe(422);
    // A caller that is not the Community form has to be able to act on this.
    expect(response.body.errors[0].message).toMatch(/at least 8 characters/);
  });

  it('refuses a title past the maximum', async () => {
    const response = await as(alice, 'post', '/api/v1/members/me/community/threads').send({ title: 'x'.repeat(221) });
    expect(response.status).toBe(422);
  });

  it('posts a reply, returns the thread with it, and moves the thread up the list', async () => {
    const created = await as(alice, 'post', '/api/v1/members/me/community/threads')
      .send({ title: `${PREFIX} a discussion to reply to` });
    const threadId = created.body.data.id;
    const before = await prisma.discussionThread.findUniqueOrThrow({ where: { id: threadId } });

    const reply = await as(bob, 'post', `/api/v1/members/me/community/threads/${threadId}/replies`)
      .send({ body: 'A considered reply from another member.' });

    expect(reply.status).toBe(201);
    expect(reply.body.data.replies).toHaveLength(1);
    expect(reply.body.data.replies[0]).toMatchObject({ author: `${PREFIX} bob`, mine: true });

    const after = await prisma.discussionThread.findUniqueOrThrow({ where: { id: threadId } });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it('refuses an empty reply and 404s an unknown thread', async () => {
    const created = await as(alice, 'post', '/api/v1/members/me/community/threads')
      .send({ title: `${PREFIX} another discussion here` });
    expect((await as(alice, 'post', `/api/v1/members/me/community/threads/${created.body.data.id}/replies`).send({ body: '   ' })).status).toBe(422);
    expect((await as(alice, 'post', '/api/v1/members/me/community/threads/nope/replies').send({ body: 'hello' })).status).toBe(404);
  });
});

describe('direct messages', () => {
  const send = (actor: Actor, peer: Actor, body: string) =>
    as(actor, 'post', `/api/v1/members/me/community/messages/${peer.userId}`).send({ body });

  it('starts one thread and reuses it, visible to both members', async () => {
    const first = await send(alice, bob, 'Hello, shall we collaborate?');
    expect(first.status).toBe(201);
    expect(first.body.data.messages).toHaveLength(1);

    await send(alice, bob, 'Following up on that.');
    await send(bob, alice, 'Yes — happy to.');

    // One conversation, not three.
    expect(await prisma.conversation.count({ where: { kind: 'DIRECT' } })).toBe(1);

    const asBob = await as(bob, 'get', `/api/v1/members/me/community/messages/${alice.userId}`);
    expect(asBob.body.data.messages).toHaveLength(3);
    // Authorship is from the reader's point of view.
    expect(asBob.body.data.messages.map((m: { mine: boolean }) => m.mine)).toEqual([false, false, true]);
  });

  it('returns an empty thread before anything is sent', async () => {
    const response = await as(alice, 'get', `/api/v1/members/me/community/messages/${bob.userId}`);
    expect(response.body.data.conversationId).toBeNull();
    expect(response.body.data.messages).toEqual([]);
  });

  it('refuses messaging yourself, an empty body, and an unknown member', async () => {
    expect((await send(alice, alice, 'hi')).status).toBe(422);
    expect((await send(alice, bob, '   ')).status).toBe(422);
    expect((await as(alice, 'post', '/api/v1/members/me/community/messages/nope').send({ body: 'hi' })).status).toBe(404);
  });

  it('keeps direct messages out of the CRO queue', async () => {
    await send(alice, bob, 'This is private to the two of us.');
    // A normal CRO thread, for contrast.
    await as(alice, 'post', '/api/v1/members/me/conversations')
      .send({ subject: `${PREFIX} a question for the office`, category: 'General', body: 'Please advise.' });

    const queue = await request(app)
      .get('/api/v1/admin/conversations')
      .set('Authorization', `Bearer ${adminToken}`);

    const subjects = queue.body.data.items.map((c: { subject: string }) => c.subject);
    expect(subjects).toContain(`${PREFIX} a question for the office`);
    expect(subjects.some((s: string) => s.includes(`${PREFIX} alice &`))).toBe(false);
    expect(queue.body.data.items.every((c: { id: string }) => Boolean(c.id))).toBe(true);
  });

  it('still shows the member their own direct thread on the messages page', async () => {
    await send(alice, bob, 'A direct note.');

    const mine = await as(bob, 'get', '/api/v1/members/me/conversations');
    expect(mine.body.data.items.some((c: { subject: string }) => c.subject.includes(`${PREFIX} alice &`))).toBe(true);
  });
});

describe('authorization', () => {
  it('refuses every community write from a non-member', async () => {
    const group = await prisma.interestGroup.create({ data: { name: `${PREFIX} group`, tag: 'Active' } });
    const calls: Array<Promise<{ status: number }>> = [
      as(adminToken, 'post', '/api/v1/members/me/community/connections').send({ profileId: bob.profileId }),
      as(adminToken, 'post', `/api/v1/members/me/community/groups/${group.id}/join`),
      as(adminToken, 'post', '/api/v1/members/me/community/threads').send({ title: `${PREFIX} an admin discussion` }),
      as(adminToken, 'post', `/api/v1/members/me/community/messages/${bob.userId}`).send({ body: 'hi' }),
    ];

    // ADMIN passes requireRole('MEMBER') via the operational bypass, but has no
    // member profile, so the service refuses to act as one.
    for (const call of calls) {
      expect((await call).status).toBe(404);
    }
  });
});
