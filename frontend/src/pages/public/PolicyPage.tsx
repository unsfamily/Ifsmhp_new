import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import Button from '../../components/common/Button';

type PolicySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type Policy = {
  title: string;
  intro: string;
  sections: PolicySection[];
};

const policies: Record<string, Policy> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    intro: 'This policy explains how IFSMHP handles information when you browse the public site, apply for membership, contact us, or use member services.',
    sections: [
      {
        heading: 'Information we handle',
        paragraphs: ['Depending on how you use the platform, information may include:'],
        bullets: [
          'Account and membership details such as your name, email address, professional role, organization, profile information, and credentials you submit.',
          'Messages and materials you choose to send through contact, support, publication, project, or community features.',
          'Technical and security information needed to operate the service, such as session identifiers, access records, and request metadata.',
        ],
      },
      {
        heading: 'How information is used',
        paragraphs: ['Information is used to provide and maintain the platform, verify email addresses, review membership applications, respond to inquiries, support member workflows, protect accounts, and meet applicable operational or legal obligations.'],
      },
      {
        heading: 'Sharing and service providers',
        paragraphs: ['IFSMHP does not offer personal information for sale. Information may be available to authorized personnel who need it to perform their duties, and to service providers supporting hosting, email delivery, file storage, or security. Information may also be disclosed when required by law or necessary to protect people, the platform, or organizational rights.'],
      },
      {
        heading: 'Storage, security, and retention',
        paragraphs: ['Reasonable technical and organizational safeguards are used to protect information. No online service can guarantee absolute security. Information is retained only as needed for the purposes described here, subject to operational, recordkeeping, and legal requirements. Specific retention periods and the applicable data-protection jurisdiction require organizational confirmation.'],
      },
      {
        heading: 'Your choices and requests',
        paragraphs: ['You may contact IFSMHP to ask about, correct, or request deletion of personal information, subject to identity checks and applicable recordkeeping obligations. Some information is necessary to provide account or membership services; removing it may affect access. Use the Contact page to submit a request.'],
      },
      {
        heading: 'Children and sensitive information',
        paragraphs: ['The membership platform is intended for adult researchers and mental health professionals, not children. Do not submit patient-identifiable or other sensitive third-party information unless a feature specifically requires it and you are authorized to share it.'],
      },
      {
        heading: 'Policy updates',
        paragraphs: ['This policy may be revised as the platform and its practices change. The approved effective date and the applicable legal requirements should be confirmed before this draft is treated as final.'],
      },
    ],
  },
  'terms-of-service': {
    title: 'Terms of Service',
    intro: 'These terms describe the expected use of the IFSMHP website and member platform. They are draft terms and require organizational and legal approval before adoption.',
    sections: [
      {
        heading: 'Eligibility and accounts',
        paragraphs: ['Provide accurate information when creating an account or applying for membership. Keep your sign-in and verification details secure, and notify IFSMHP if you suspect unauthorized access. Membership applications are subject to review; submitting an application does not guarantee acceptance.'],
      },
      {
        heading: 'Acceptable use',
        paragraphs: ['Use the platform lawfully, honestly, and in a way that respects other people. You must not:'],
        bullets: [
          'Misrepresent your identity, qualifications, institutional affiliation, or authority to act for another person.',
          'Upload unlawful, malicious, infringing, deceptive, or unauthorized material.',
          'Attempt to bypass access controls, disrupt the service, probe systems without permission, or misuse another person’s account or information.',
          'Use member contact details or platform content for unsolicited promotion, harassment, or unrelated commercial purposes.',
        ],
      },
      {
        heading: 'Content and intellectual property',
        paragraphs: ['You retain rights in material you create, subject to rights belonging to co-authors and other rights holders. By submitting material, you confirm that you have the permissions needed for IFSMHP to receive, review, store, and display it as required to operate the feature you use. Publication rights, licences, attribution, and any reuse terms should be stated with the individual work; submission alone does not transfer copyright.'],
      },
      {
        heading: 'Research and professional information',
        paragraphs: ['You are responsible for the accuracy, evidence, permissions, and required disclosures associated with your submissions. Platform materials are provided for professional and informational use and are not a substitute for individualized medical, legal, or other professional advice.'],
      },
      {
        heading: 'Availability and account action',
        paragraphs: ['The platform may change, be interrupted, or have features withdrawn for maintenance, security, or operational reasons. IFSMHP may investigate suspected misuse and restrict access where reasonably necessary, subject to applicable law and any review process adopted by the organization.'],
      },
      {
        heading: 'Changes and contact',
        paragraphs: ['Terms may be updated when the service changes. The governing law, dispute process, liability provisions, and effective date have not been specified in the project and must be completed by IFSMHP before these terms are finalized. Contact IFSMHP through the Contact page with questions.'],
      },
    ],
  },
  'code-of-ethics': {
    title: 'Code of Ethics',
    intro: 'IFSMHP expects members and contributors to uphold integrity, respect, and responsibility in research, professional exchange, and use of the platform.',
    sections: [
      {
        heading: 'Integrity in research and communication',
        paragraphs: ['Represent evidence, methods, credentials, affiliations, and results truthfully. Do not fabricate, falsify, plagiarize, selectively misrepresent findings, or knowingly circulate unsupported claims as established fact. Correct material errors promptly.'],
      },
      {
        heading: 'Respect and inclusion',
        paragraphs: ['Engage in good-faith discussion and treat colleagues, staff, research participants, and the public with dignity. Discrimination, intimidation, harassment, threats, and retaliation are not acceptable. Critique ideas and evidence without targeting people.'],
      },
      {
        heading: 'Privacy and confidentiality',
        paragraphs: ['Protect confidential information encountered through IFSMHP activities. Do not disclose identifiable participant, patient, member, or applicant information without a valid basis and appropriate authorization. Use secure channels and share only what is necessary.'],
      },
      {
        heading: 'Conflicts of interest',
        paragraphs: ['Disclose financial, professional, institutional, or personal interests that could reasonably affect a review, recommendation, publication, or decision. Disclosures should be clear, timely, and relevant to the work.'],
      },
      {
        heading: 'Responsible professional practice',
        paragraphs: ['Follow the laws, research approvals, consent requirements, professional standards, and institutional policies that apply to your work. Give appropriate credit to contributors and respect authorship, data, image, and copyright permissions. Do not use IFSMHP membership or branding to imply endorsement without authorization.'],
      },
      {
        heading: 'Reporting and review',
        paragraphs: ['Raise good-faith concerns about serious ethical or platform misconduct through the Contact page or an appropriate organizational channel. Share only information needed to explain the concern. IFSMHP should handle reports fairly, protect confidentiality as far as practicable, and provide an opportunity to respond under its approved procedures.'],
      },
      {
        heading: 'Application',
        paragraphs: ['This code is a public statement of expected conduct, not a substitute for professional licensing rules or institutional review. IFSMHP should approve its enforcement process, appeal route, and effective date before treating it as binding membership policy.'],
      },
    ],
  },
  'cookie-policy': {
    title: 'Cookie Policy',
    intro: 'This page describes the browser storage and cookies currently used to support core site and account functions.',
    sections: [
      {
        heading: 'Essential session technology',
        paragraphs: ['The platform uses an authentication refresh cookie to maintain and rotate a signed-in session. It is configured as HTTP-only, uses SameSite=Lax, and is marked Secure in production. This cookie is limited to authentication endpoints and is not used for advertising.'],
      },
      {
        heading: 'Browser storage',
        paragraphs: ['The frontend currently uses browser storage for essential workflow state:'],
        bullets: [
          'Local storage holds the access token and, in development/demo flows, may hold mock-user or draft registration state.',
          'Session storage can hold temporary one-time-code verification progress so a refresh does not discard the in-progress step.',
        ],
      },
      {
        heading: 'Analytics and advertising',
        paragraphs: ['This application does not currently present an optional analytics or advertising consent control. Any future analytics, advertising, or non-essential tracking technology should be disclosed here and implemented with any consent required by applicable law.'],
      },
      {
        heading: 'Managing browser data',
        paragraphs: ['You can clear cookies and site data in your browser settings. Doing so may sign you out or clear an in-progress registration or verification step. Blocking essential storage may prevent login and member features from working correctly.'],
      },
      {
        heading: 'Updates',
        paragraphs: ['Storage and cookie use may change as features are added. IFSMHP should review this page against production configuration, identify any third-party technologies, and confirm applicable consent requirements before final publication.'],
      },
    ],
  },
};

const policyLinks = [
  { to: '/privacy-policy', label: 'Privacy Policy' },
  { to: '/terms-of-service', label: 'Terms of Service' },
  { to: '/code-of-ethics', label: 'Code of Ethics' },
  { to: '/cookie-policy', label: 'Cookie Policy' },
];

export default function PolicyPage() {
  const { pathname } = useLocation();
  const slug = pathname.split('/').filter(Boolean).at(-1) ?? '';
  const policy = policies[slug];

  if (!policy) return null;

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-paper-border bg-paper-raised">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:py-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-forum-700 hover:text-forum-900">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
          <div className="mt-8 flex items-center gap-2 text-sm font-semibold uppercase text-slateteal-700">
            <ShieldCheck className="h-4 w-4" />
            IFSMHP Policies
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">{policy.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-ink-muted">{policy.intro}</p>
          <p className="mt-5 inline-flex rounded-md border border-brass-500/30 bg-brass-100/50 px-3 py-2 text-sm font-medium text-forum-900">
            Draft for organizational and legal review
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14 lg:py-14">
        <article className="min-w-0 divide-y divide-paper-border">
          {policy.sections.map((section, index) => (
            <section key={section.heading} id={`policy-section-${index + 1}`} className="scroll-mt-28 py-7 first:pt-0 last:pb-0">
              <h2 className="font-display text-xl font-semibold text-forum-900">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed text-ink-muted">{paragraph}</p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-muted marker:text-slateteal-600">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
            </section>
          ))}
          <div className="pt-8">
            <Button as="link" to="/contact" variant="outline">
              Contact IFSMHP
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </article>

        <aside className="h-fit border-t border-paper-border pt-6 lg:sticky lg:top-28 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h2 className="text-xs font-semibold uppercase text-ink-subtle">Other policies</h2>
          <nav aria-label="Other policies" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2">
            {policyLinks.filter((link) => link.to !== `/${slug}`).map((link) => (
              <Link key={link.to} to={link.to} className="text-sm font-medium text-forum-700 hover:text-forum-900 hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}