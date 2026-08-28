import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';

// Mail is stubbed so no message leaves the machine; `failNextSend` stands in for
// a transport that is down.
const sentApprovals: Array<{ email: string; memberId: string }> = [];
let failNextSend: Error | null = null;
vi.mock('../services/mail.service', () => ({
  sendOtpEmail: vi.fn(async () => undefined),
  verifyTransport: vi.fn(async () => undefined),
  sendApprovalEmail: vi.fn(async (email: string, _fullName: string, memberId: string) => {
    if (failNextSend) {
      const err = failNextSend;
      failNextSend = null;
      throw err;
    }
    sentApprovals.push({ email, memberId });
  }),
}));

import { prisma } from '../config/database';
import {
  adminMembers,
  adminMemberDetail,
  reviewMember,
  approveMember,
  rejectMember,
  resendApprovalEmail,
} from '../services/platform.service';

/**
 * Exercises the membership review queue against the real database.
 *
 * Fixtures are namespaced by this prefix and removed afterwards, so seeded and
 * real applications are never touched.
 */
const PREFIX = 'queue-test';
const email = (n: string) => `${PREFIX}.${n}@example.test`;

/** Minimal stand-in for the Express request the service reads query params from. */
const req = (query: Record<string, string | number> = {}) => ({ query }) as unknown as Request;

let adminId: string;

async function makeApplicant(opts: {
  key: string;
  professionalType: string;
  priority?: string;
  submittedAt?: Date;
}) {
  const user = await prisma.user.create({
    data: {
      email: email(opts.key),
      passwordHash: null,
      fullName: `Queue Test ${opts.key}`,
      role: 'APPLICANT',
      status: 'PENDING',
    },
  });
  const profile = await prisma.memberProfile.create({
    data: {
      userId: user.id,
      professionalTitle: opts.professionalType,
      professionalType: opts.professionalType,
      institution: `${PREFIX} Institute`,
      country: 'Testland',
      education: { create: [{ degree: `PhD ${opts.key}`, institution: `${PREFIX} University` }] },
    },
  });
  const application = await prisma.membershipApplication.create({
    data: {
      applicationCode: `${PREFIX.toUpperCase()}-${opts.key}-${Date.now()}`,
      userId: user.id,
      profileId: profile.id,
      credentialsText: `Credentials for ${opts.key}`,
      educationText: `Education for ${opts.key}`,
      researchText: `Research for ${opts.key}`,
      priority: opts.priority ?? 'Standard',
      ...(opts.submittedAt ? { submittedAt: opts.submittedAt } : {}),
      histories: { create: { toStatus: 'PENDING', note: 'Submitted by applicant' } },
    },
  });
  return { user, application };
}

async function wipe() {
  const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeEach(() => {
  sentApprovals.length = 0;
  failNextSend = null;
});

beforeAll(async () => {
  await wipe();
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!admin) throw new Error('An ADMIN user is required; run the seed first.');
  adminId = admin.id;
});

afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe('membership queue listing', () => {
  it('returns a newly submitted application as Pending', async () => {
    const { application } = await makeApplicant({ key: 'a', professionalType: 'Psychologist' });

    const result = await adminMembers(req({ applicationStatus: 'Pending', q: PREFIX, limit: 50 }));
    const row = result.items.find((m) => m.applicationId === application.applicationCode);

    // This is the reported failure: a verified registration must reach the queue.
    expect(row).toBeDefined();
    expect(row?.status).toBe('Pending');
    expect(row?.slaDays).toBeGreaterThanOrEqual(0);
    expect(row?.professionalTitle).toBe('Psychologist');
    expect(row?.highestDegree).toBe('PhD a');
  });

  it('filters on the application status, not the user status', async () => {
    const { application } = await makeApplicant({ key: 'b', professionalType: 'Counselor' });
    await reviewMember(application.id, adminId);

    const pending = await adminMembers(req({ applicationStatus: 'Pending', q: PREFIX, limit: 50 }));
    const inReview = await adminMembers(req({ applicationStatus: 'Under Review', q: PREFIX, limit: 50 }));

    expect(pending.items.map((m) => m.applicationId)).not.toContain(application.applicationCode);
    expect(inReview.items.map((m) => m.applicationId)).toContain(application.applicationCode);
  });

  it('narrows by professional type, priority and submitted date', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const { application } = await makeApplicant({
      key: 'c',
      professionalType: 'Social Worker',
      priority: 'Urgent',
      submittedAt: old,
    });

    const byType = await adminMembers(req({ professionalType: 'Social Worker', q: PREFIX, limit: 50 }));
    expect(byType.items.map((m) => m.applicationId)).toContain(application.applicationCode);

    const byPriority = await adminMembers(req({ priority: 'Urgent', q: PREFIX, limit: 50 }));
    expect(byPriority.items.every((m) => m.priority === 'Urgent')).toBe(true);

    const wrongType = await adminMembers(req({ professionalType: 'Psychologist', q: PREFIX, limit: 50 }));
    expect(wrongType.items.map((m) => m.applicationId)).not.toContain(application.applicationCode);

    // Submitted 30 days ago, so a window starting yesterday must exclude it.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const recent = await adminMembers(
      req({ submittedFrom: yesterday.toISOString().slice(0, 10), q: PREFIX, limit: 50 }),
    );
    expect(recent.items.map((m) => m.applicationId)).not.toContain(application.applicationCode);
  });

  it('paginates without repeating or dropping rows', async () => {
    const all = await adminMembers(req({ q: PREFIX, limit: 50 }));
    expect(all.pagination.total).toBeGreaterThanOrEqual(3);

    const page1 = await adminMembers(req({ q: PREFIX, limit: 2, page: 1 }));
    const page2 = await adminMembers(req({ q: PREFIX, limit: 2, page: 2 }));

    expect(page1.items).toHaveLength(2);
    expect(page1.pagination.total).toBe(all.pagination.total);
    expect(page1.pagination.pages).toBe(Math.ceil(all.pagination.total / 2));

    const overlap = page1.items.filter((a) => page2.items.some((b) => b.id === a.id));
    expect(overlap).toHaveLength(0);
  });

  it('counts the whole queue, not just the returned page', async () => {
    const onePage = await adminMembers(req({ q: PREFIX, limit: 1 }));
    expect(onePage.items).toHaveLength(1);
    expect(onePage.counts.inQueue).toBe(onePage.counts.pending + onePage.counts.underReview);
    expect(onePage.counts.pending).toBeGreaterThanOrEqual(1);
  });
});

describe('admin decisions', () => {
  it('moves a pending application to review, idempotently', async () => {
    const { application } = await makeApplicant({ key: 'd', professionalType: 'Therapist' });

    const first = await reviewMember(application.id, adminId);
    expect(first).toMatchObject({ status: 'Under Review', changed: true });

    const second = await reviewMember(application.id, adminId);
    expect(second).toMatchObject({ status: 'Under Review', changed: false });

    const detail = await adminMemberDetail(application.id);
    expect(detail.status).toBe('Under Review');
    expect(detail.statusValue).toBe('UNDER_REVIEW');
    // The transition is recorded for audit.
    expect(detail.statusHistory.some((h) => h.toStatus === 'UNDER_REVIEW')).toBe(true);
  });

  it('approves: issues a member ID and activates the account', async () => {
    const { user, application } = await makeApplicant({ key: 'e', professionalType: 'Psychiatrist' });

    const result = await approveMember(application.id, adminId, 'Credentials verified');
    expect(result.memberId).toMatch(/^IFSMHP-\d{4}-\d{6}$/);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { memberProfile: true, membershipApplication: true },
    });
    expect(after.role).toBe('MEMBER');
    expect(after.status).toBe('ACTIVE');
    expect(after.memberProfile?.memberId).toBe(result.memberId);
    expect(after.membershipApplication?.status).toBe('APPROVED');

    // An approved application leaves the pending queue.
    const pending = await adminMembers(req({ applicationStatus: 'Pending', q: PREFIX, limit: 50 }));
    expect(pending.items.map((m) => m.applicationId)).not.toContain(application.applicationCode);
  });

  it('rejects: records the reason and blocks the account', async () => {
    const { user, application } = await makeApplicant({ key: 'f', professionalType: 'Clinician' });

    await rejectMember(application.id, adminId, 'Credentials could not be verified.');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { membershipApplication: true },
    });
    expect(after.status).toBe('REJECTED');
    expect(after.membershipApplication?.status).toBe('REJECTED');
    expect(after.membershipApplication?.rejectionReason).toContain('could not be verified');
  });

  it('refuses to move an already-decided application back to review', async () => {
    const { application } = await makeApplicant({ key: 'g', professionalType: 'Counselor' });
    await approveMember(application.id, adminId);

    await expect(reviewMember(application.id, adminId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('sends exactly one acknowledgement and records the delivery', async () => {
    const { user, application } = await makeApplicant({ key: 'i', professionalType: 'Psychologist' });

    const result = await approveMember(application.id, adminId);
    expect(result.emailSent).toBe(true);

    expect(sentApprovals).toHaveLength(1);
    expect(sentApprovals[0]).toMatchObject({ email: user.email, memberId: result.memberId });

    const row = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } });
    expect(row.approvalEmailSentAt).not.toBeNull();
    expect(row.approvalEmailError).toBeNull();
    expect(row.approvalEmailAttempts).toBe(1);
  });

  it('keeps the member approved when the acknowledgement fails', async () => {
    const { user, application } = await makeApplicant({ key: 'j', professionalType: 'Counselor' });
    failNextSend = new Error('smtp is down');

    const result = await approveMember(application.id, adminId);

    // The approval itself must survive a mail outage.
    expect(result.issued).toBe(true);
    expect(result.memberId).toMatch(/^IFSMHP-\d{4}-\d{6}$/);
    expect(result.emailSent).toBe(false);
    expect(result.emailError).toContain('smtp is down');

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { memberProfile: true, membershipApplication: true },
    });
    expect(after.role).toBe('MEMBER');
    expect(after.status).toBe('ACTIVE');
    expect(after.memberProfile?.memberId).toBe(result.memberId);
    expect(after.membershipApplication?.approvalEmailSentAt).toBeNull();
    expect(after.membershipApplication?.approvalEmailError).toContain('smtp is down');
  });

  it('retries a failed acknowledgement, then refuses to send a second one', async () => {
    const { user, application } = await makeApplicant({ key: 'k', professionalType: 'Therapist' });
    failNextSend = new Error('smtp is down');
    await approveMember(application.id, adminId);
    expect(sentApprovals).toHaveLength(0);

    const retry = await resendApprovalEmail(application.id, adminId);
    expect(retry.emailSent).toBe(true);
    expect(sentApprovals).toHaveLength(1);
    expect(sentApprovals[0]?.email).toBe(user.email);

    const row = await prisma.membershipApplication.findUniqueOrThrow({ where: { id: application.id } });
    expect(row.approvalEmailSentAt).not.toBeNull();
    expect(row.approvalEmailError).toBeNull();
    expect(row.approvalEmailAttempts).toBe(2);

    // The duplicate guard: a second retry cannot produce a second email.
    await expect(resendApprovalEmail(application.id, adminId)).rejects.toMatchObject({ statusCode: 409 });
    expect(sentApprovals).toHaveLength(1);
  });

  it('refuses a retry for an application that was never approved', async () => {
    const { application } = await makeApplicant({ key: 'l', professionalType: 'Clinician' });
    await expect(resendApprovalEmail(application.id, adminId)).rejects.toMatchObject({ statusCode: 409 });
    expect(sentApprovals).toHaveLength(0);
  });

  it('refuses a second approval, so no second acknowledgement is possible', async () => {
    const { application } = await makeApplicant({ key: 'm', professionalType: 'Psychiatrist' });
    await approveMember(application.id, adminId);
    expect(sentApprovals).toHaveLength(1);

    await expect(approveMember(application.id, adminId)).rejects.toMatchObject({ statusCode: 409 });
    expect(sentApprovals).toHaveLength(1);
  });

  it('reports the account status separately from the application status', async () => {
    const { application } = await makeApplicant({ key: 'n', professionalType: 'Social Worker' });
    await approveMember(application.id, adminId);

    const listed = await adminMembers(req({ q: PREFIX, limit: 50 }));
    const row = listed.items.find((m) => m.applicationId === application.applicationCode);

    // The directory filters on the account; the queue filters on the application.
    expect(row?.accountStatus).toBe('Active');
    expect(row?.status).toBe('Approved');
    expect(row?.approvedAt).toBeTruthy();
    expect(row?.approvalEmailSentAt).toBeTruthy();

    const active = await adminMembers(req({ status: 'Active', q: PREFIX, limit: 50 }));
    expect(active.items.map((m) => m.applicationId)).toContain(application.applicationCode);
  });

  it('narrows by member ID, country and registration date', async () => {
    const { application } = await makeApplicant({ key: 'o', professionalType: 'Psychologist' });
    const { memberId } = await approveMember(application.id, adminId);

    const byMemberId = await adminMembers(req({ memberId, limit: 50 }));
    expect(byMemberId.items).toHaveLength(1);
    expect(byMemberId.items[0]?.memberId).toBe(memberId);

    const byCountry = await adminMembers(req({ country: 'Testland', q: PREFIX, limit: 50 }));
    expect(byCountry.items.length).toBeGreaterThan(0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const future = await adminMembers(
      req({ registeredFrom: tomorrow.toISOString().slice(0, 10), q: PREFIX, limit: 50 }),
    );
    expect(future.items).toHaveLength(0);
  });

  it('exposes the submitted answers an admin needs to decide', async () => {
    const { application } = await makeApplicant({ key: 'h', professionalType: 'Psychologist' });
    const detail = await adminMemberDetail(application.id);

    expect(detail.credentialsText).toBe('Credentials for h');
    expect(detail.educationText).toBe('Education for h');
    expect(detail.researchText).toBe('Research for h');
  });
});
