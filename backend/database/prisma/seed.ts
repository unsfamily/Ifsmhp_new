import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clearDevelopmentData() {
  await prisma.auditLog.deleteMany();
  await prisma.reportRun.deleteMany();
  await prisma.reportDefinition.deleteMany();
  await prisma.platformSetting.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.announcementDelivery.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.inquiryStatusHistory.deleteMany();
  await prisma.inquiryReply.deleteMany();
  await prisma.inquiryNote.deleteMany();
  await prisma.contactInquiryAttachment.deleteMany();
  await prisma.contactInquiry.deleteMany();
  await prisma.memberConnection.deleteMany();
  await prisma.discussionReply.deleteMany();
  await prisma.discussionThread.deleteMany();
  await prisma.interestGroupMember.deleteMany();
  await prisma.interestGroup.deleteMany();
  await prisma.galleryTag.deleteMany();
  await prisma.galleryItem.deleteMany();
  await prisma.galleryBanner.deleteMany();
  await prisma.galleryAlbum.deleteMany();
  await prisma.eventResource.deleteMany();
  await prisma.eventRegistration.deleteMany();
  await prisma.eventTag.deleteMany();
  await prisma.eventSpeaker.deleteMany();
  await prisma.event.deleteMany();
  await prisma.linkedRecord.deleteMany();
  await prisma.sharedLink.deleteMany();
  await prisma.messageAttachment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.publicationView.deleteMany();
  await prisma.publicationStatusHistory.deleteMany();
  await prisma.publicationReview.deleteMany();
  await prisma.publicationFile.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.supportRequestHistory.deleteMany();
  await prisma.supportRequestType.deleteMany();
  await prisma.supportRequest.deleteMany();
  await prisma.projectStatusHistory.deleteMany();
  await prisma.projectResourceLink.deleteMany();
  await prisma.projectSupportType.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.project.deleteMany();
  await prisma.professionalCredential.deleteMany();
  await prisma.researchInterest.deleteMany();
  await prisma.education.deleteMany();
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.membershipApplication.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.fileObject.deleteMany();
  await prisma.memberIdSequence.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed development data in production.');
  }

  await prisma.emailOtp.deleteMany();
  await clearDevelopmentData();

  // Only administrators keep a password. Members and applicants sign in with a
  // one-time code emailed to them, so they have no password hash at all.
  const passwordHash = await bcrypt.hash('ChangeMeNow!2026', 12);
  const admin = await prisma.user.create({
    data: {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@ifsmhp.local',
      passwordHash,
      fullName: 'Dr. Elaine Porter',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@ifsmhp.local',
      passwordHash: null,
      fullName: 'Dr. Sarah Chen',
      role: 'MEMBER',
      status: 'ACTIVE',
      memberProfile: {
        create: {
          memberId: 'IFSMHP-2026-000001',
          professionalTitle: 'Clinical Research Scientist',
          professionalType: 'Research Scholar / Scientist',
          institution: 'Stanford Center for Digital Mental Health',
          country: 'United States',
          phone: '+1 555 0142',
          biography: 'Development-only profile used to exercise member workflows.',
          approvedAt: new Date('2026-01-15T10:00:00Z'),
          education: {
            create: [
              { degree: 'PhD', institution: 'Stanford University', field: 'Clinical Psychology', endYear: '2018' },
              { degree: 'MPH', institution: 'Johns Hopkins University', field: 'Public Health', endYear: '2013' },
            ],
          },
          interests: {
            create: [
              { name: 'Digital Mental Health' },
              { name: 'Youth Mental Health Policy' },
              { name: 'Trauma-Informed Care' },
            ],
          },
        },
      },
    },
    include: { memberProfile: true },
  });

  const applicant = await prisma.user.create({
    data: {
      email: 'applicant@ifsmhp.local',
      passwordHash: null,
      fullName: 'Dr. Anika Kapoor',
      role: 'APPLICANT',
      status: 'PENDING',
      memberProfile: {
        create: {
          professionalTitle: 'Clinical Psychologist',
          professionalType: 'Psychologist',
          institution: 'AIIMS Delhi',
          country: 'India',
          phone: '+91 98765 43210',
          biography: 'Development-only pending application.',
          education: { create: [{ degree: 'MD Psychiatry', institution: 'AIIMS Delhi', endYear: '2014' }] },
          interests: { create: [{ name: 'Adolescent Mental Health' }, { name: 'CBT' }] },
        },
      },
    },
    include: { memberProfile: true },
  });

  await prisma.membershipApplication.create({
    data: {
      applicationCode: 'APP-2026-000001',
      userId: applicant.id,
      profileId: applicant.memberProfile!.id,
      credentialsText: 'MD Psychiatry; licensed clinical psychologist; IFSMHP development seed.',
      educationText: 'MD Psychiatry, AIIMS Delhi, 2014.',
      researchText: 'Adolescent mental health, CBT, community-based care.',
      status: 'PENDING',
      histories: { create: { toStatus: 'PENDING', note: 'Development seed application submitted.' } },
    },
  });

  await prisma.memberIdSequence.create({ data: { year: 2026, nextNumber: 2 } });

  const project = await prisma.project.create({
    data: {
      ownerId: member.id,
      title: 'Digital Peer Support for Early-Career Clinicians',
      category: 'Digital Mental Health',
      description: 'Development-only project seeded for member/admin review workflows.',
      timeline: '2026 Q3-Q4',
      budget: 'USD 18,000',
      status: 'UNDER_REVIEW',
      submittedAt: new Date('2026-08-12T09:30:00Z'),
      supportTypes: { create: [{ kind: 'MORAL' }, { kind: 'FUNDING' }] },
      histories: { create: { toStatus: 'UNDER_REVIEW', actorId: member.id, note: 'Seeded review state.' } },
      resourceLinks: { create: [{ label: 'Protocol draft', url: 'https://example.test/protocol' }] },
    },
  });

  await prisma.supportRequest.create({
    data: {
      requesterId: member.id,
      projectId: project.id,
      subject: 'Request for collaboration letter',
      description: 'Development-only support ticket for official IFSMHP backing.',
      priority: 'High',
      status: 'PENDING',
      types: { create: [{ kind: 'OFFICIAL' }] },
      histories: { create: { toStatus: 'PENDING', actorId: member.id, note: 'Seeded request.' } },
    },
  });

  const publishedPublication = await prisma.publication.create({
    data: {
      authorId: member.id,
      projectId: project.id,
      title: 'Ethical Evaluation of Digital Peer Support Models',
      slug: 'ethical-evaluation-digital-peer-support-models',
      abstract: 'Development-only abstract for public research and admin publication workflows.',
      fullText: 'Development-only full text. Replace with editorially reviewed content in production.',
      venue: 'IFSMHP Research Notes',
      category: 'Clinical Research',
      researchType: 'Review',
      status: 'PUBLISHED',
      doi: '10.0000/ifsmhp.seed.001',
      featured: true,
      viewCount: 1840,
      downloadCount: 214,
      submittedAt: new Date('2026-08-01T08:00:00Z'),
      approvedAt: new Date('2026-08-05T08:00:00Z'),
      publishedAt: new Date('2026-08-08T08:00:00Z'),
      histories: { create: { toStatus: 'PUBLISHED', actorId: admin.id, note: 'Development seed publication.' } },
    },
  });

  await prisma.publication.create({
    data: {
      authorId: member.id,
      title: 'Cross-Cultural Supervision Patterns in Community Clinics',
      abstract: 'Development-only manuscript waiting for admin approval.',
      category: 'Policy',
      researchType: 'Original Research',
      status: 'SUBMITTED',
      submittedAt: new Date('2026-08-20T08:00:00Z'),
      histories: { create: { toStatus: 'SUBMITTED', actorId: member.id, note: 'Development seed manuscript.' } },
    },
  });

  await prisma.productReview.create({
    data: {
      title: 'Mindful Metrics Platform Review',
      author: 'IFSMHP Review Panel',
      authorRole: 'Digital Ethics Working Group',
      category: 'Assessment Tools',
      subjects: ['privacy', 'workflow', 'clinical validation'],
      rating: 4,
      publishedAt: new Date('2026-08-10T08:00:00Z'),
      readMinutes: 7,
      endorsements: 18,
      comments: 4,
      summary: 'Development-only product review used by the public product review page.',
      pros: ['Clear consent model', 'Good export controls'],
      cons: ['Limited localization'],
      verdict: 'Promising with careful governance.',
      methodology: 'Panel review against IFSMHP development criteria.',
      ethics: 'No patient data used in this seed record.',
      conflicts: 'Development seed; no conflicts recorded.',
      tags: ['digital-health', 'ethics'],
      featured: true,
      region: 'Global',
    },
  });

  const event = await prisma.event.create({
    data: {
      creatorId: admin.id,
      title: 'Global Mental Health Research Roundtable',
      slug: 'global-mental-health-research-roundtable',
      shortDescription: 'Development-only public event for seeded workflows.',
      longDescription: 'A seeded IFSMHP roundtable used to test public and admin event screens.',
      date: new Date('2026-09-18T15:00:00Z'),
      timeStart: '15:00',
      timeEnd: '16:30',
      timezone: 'UTC',
      location: 'Online',
      format: 'Virtual',
      audience: 'Public',
      capacity: 250,
      organizer: 'IFSMHP Secretariat',
      organizerEmail: 'events@ifsmhp.local',
      status: 'PUBLISHED',
      featured: true,
      speakers: { create: [{ name: 'Prof. Rajiv Mehta', sort: 1 }, { name: 'Dr. Maya Fernández', sort: 2 }] },
      tags: { create: [{ name: 'Roundtable' }, { name: 'Research' }] },
      registrations: { create: [{ name: 'Seed Attendee', email: 'attendee@example.test' }] },
      resources: { create: [{ title: 'Discussion brief', kind: 'link', url: 'https://example.test/brief' }] },
    },
  });

  const album = await prisma.galleryAlbum.create({
    data: {
      key: 'field-work',
      label: 'Field Work',
      coverGradient: 'from-forum-700 to-slateteal-500',
      banners: {
        create: {
          eyebrow: 'IFSMHP Gallery',
          title: 'Field Work',
          lead: 'Development-only gallery records for public and member views.',
          tagline: 'Community research in practice',
          promptSubject: 'Mental health professionals collaborating in a workshop setting.',
        },
      },
    },
  });

  await prisma.galleryItem.create({
    data: {
      albumId: album.id,
      type: 'image',
      title: 'Community Workshop Session',
      caption: 'Development-only gallery item.',
      capturedAt: new Date('2026-07-02T10:00:00Z'),
      location: 'Bengaluru, India',
      photographer: 'IFSMHP Secretariat',
      aspect: '4:3',
      sizeMB: 2.4,
      resolution: '2400x1800',
      views: 320,
      downloads: 28,
      starred: true,
      creditLine: 'IFSMHP development seed',
      tags: { create: [{ name: 'workshop' }, { name: 'community' }] },
    },
  });

  const conversation = await prisma.conversation.create({
    data: {
      subject: 'Publication review question',
      category: 'Publications',
      priority: 'Standard',
      participants: {
        create: [
          { userId: member.id, roleLabel: 'Member' },
          { userId: admin.id, roleLabel: 'CRO Office' },
        ],
      },
      messages: {
        create: [
          { senderId: member.id, senderName: 'Dr. Sarah Chen (IFSMHP-2026-000001)', senderRole: 'MEMBER', body: 'Could you confirm the next review step?' },
          { senderId: admin.id, senderName: 'CRO Office', senderRole: 'ADMIN', body: 'The manuscript is queued for final editorial review.' },
        ],
      },
      linkedRecords: { create: { label: 'Publication', recordId: publishedPublication.id, name: publishedPublication.title } },
    },
  });

  await prisma.contactInquiry.create({
    data: {
      name: 'Jordan Lee',
      email: 'jordan@example.test',
      organization: 'Community Mental Health Lab',
      country: 'United States',
      topic: 'Partnership',
      subject: 'Possible IFSMHP collaboration',
      message: 'Development-only inquiry for admin contact workflow testing.',
      priority: 'Normal',
      histories: { create: { toStatus: 'NEW', reason: 'Seed inquiry.' } },
    },
  });

  await prisma.announcement.create({
    data: {
      authorId: admin.id,
      subject: 'September research roundtable',
      body: `Development-only announcement for ${event.title}.`,
      audience: 'All Members',
      channel: 'email',
      status: 'SCHEDULED',
      scheduledAt: new Date('2026-09-01T12:00:00Z'),
      deliveries: { create: { recipientUserId: member.id, recipientEmail: member.email, status: 'Pending' } },
    },
  });

  const group = await prisma.interestGroup.create({
    data: {
      name: 'Digital Mental Health',
      tag: 'digital-health',
      members: { create: { profileId: member.memberProfile!.id } },
      threads: {
        create: {
          authorId: member.id,
          title: 'Evaluating consent in app-based peer support',
          category: 'Ethics',
          replies: { create: { authorId: member.id, body: 'Development-only discussion reply.' } },
        },
      },
    },
  });

  await prisma.reportDefinition.createMany({
    data: [
      { key: 'membership-monthly', title: 'Monthly Membership Review', category: 'Membership', description: 'Applicant volume, decisions, and SLA.', cadence: 'Monthly', format: 'xlsx', recipient: 'CRO' },
      { key: 'review-sla', title: 'Review SLA', category: 'Operations', description: 'Ageing queues across projects, support, and publications.', cadence: 'Weekly', format: 'xlsx', recipient: 'Operations' },
    ],
  });

  await prisma.platformSetting.createMany({
    data: [
      { section: 'membership', key: 'approval_sla_days', value: 5 },
      { section: 'uploads', key: 'max_file_mb', value: 25 },
      { section: 'events', key: 'default_timezone', value: 'UTC' },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, actorLabel: admin.fullName, actorRole: 'ADMIN', action: 'SeedCreated', entity: 'Development database', severity: 'SUCCESS', description: 'Development seed data installed.' },
      { actorId: member.id, actorLabel: member.fullName, actorRole: 'MEMBER', action: 'ConversationCreated', entity: `Conversation ${conversation.id}`, severity: 'INFO', description: `Seeded group ${group.name} and member conversation.` },
    ],
  });

  console.log('[seed] Development data created.');
  console.log('[seed] Admin (password sign-in): admin@ifsmhp.local / ChangeMeNow!2026');
  console.log('[seed] Member (email code): member@ifsmhp.local');
  console.log('[seed] Applicant (email code): applicant@ifsmhp.local');
  console.log('[seed] Without SMTP configured, codes are printed to this server log.');
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
