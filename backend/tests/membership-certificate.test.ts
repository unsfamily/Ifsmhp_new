import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  admissionLabel,
  branchLabel,
  cardInitials,
  certificateFacts,
  certificateFilename,
  certificateParagraphs,
  certificateText,
  designationLine,
  holderName,
  validThroughLabel,
  type CertificatePerson,
} from '../domain/membership-certificate';
import { renderMembershipCertificate } from '../services/membership-certificate-document';

const admitted = new Date('2026-01-15T10:00:00Z');

const sarah: CertificatePerson = {
  fullName: 'Dr. Sarah Chen',
  professionalTitle: 'Clinical Research Scientist',
  professionalType: 'Research Scholar / Scientist',
  institution: 'Stanford Center for Digital Mental Health',
  country: 'United States',
  memberId: 'IFSMHP-000001',
  approvedAt: admitted,
  issuedAt: admitted,
};

describe('membership certificate wording', () => {
  it('uses the registered name, designation, and a twelve-month validity', () => {
    expect(holderName(sarah.fullName)).toBe('Dr. Sarah Chen');
    expect(designationLine(sarah)).toBe('Clinical Research Scientist, Stanford Center for Digital Mental Health');
    expect(admissionLabel(admitted)).toBe('15 January 2026');
    expect(validThroughLabel(admitted)).toBe('January 2027');
    expect(branchLabel('India')).toBe('India');
    expect(branchLabel(null)).toBe('International');
    expect(cardInitials('Dr. Sarah Chen')).toBe('SC');
    expect(certificateFilename('IFSMHP-000001')).toBe('IFSMHP-Membership-Certificate-IFSMHP-000001.pdf');
  });

  it('folds characters the certificate font cannot draw and keeps the admission wording', () => {
    expect(certificateText('José  Álvarez')).toBe('Jose Alvarez');
    expect(holderName('   ')).toBe('Member');
    const paragraphs = certificateParagraphs(sarah);
    expect(paragraphs[0]).toContain('duly admitted as a Member');
    expect(paragraphs[1]).toContain('professional standing and contribution to scientific inquiry and mental health practice');
    expect(paragraphs[2]).toContain('valid through January 2027');
    expect(certificateFacts(sarah).join('\n')).toContain('IFSMHP-000001');
  });
});

describe('membership certificate pdf', () => {
  it('draws the holder onto the letterhead and embeds a portrait when one is supplied', async () => {
    const portrait = await sharp({
      create: { width: 80, height: 100, channels: 3, background: { r: 40, g: 70, b: 120 } },
    }).jpeg().toBuffer();

    const plain = await renderMembershipCertificate(sarah);
    const withPortrait = await renderMembershipCertificate(sarah, portrait);

    expect(plain.subarray(0, 4).toString()).toBe('%PDF');
    expect(withPortrait.subarray(0, 4).toString()).toBe('%PDF');
    expect(plain.length).toBeGreaterThan(100_000);
    expect(withPortrait.length).toBeGreaterThan(plain.length);
  });

  it('still produces a card when the member has no portrait', async () => {
    const pdf = await renderMembershipCertificate({
      ...sarah,
      fullName: 'Dr. Anika Kapoor',
      professionalTitle: 'Clinical Psychologist',
      professionalType: 'Psychologist',
      institution: 'AIIMS Delhi',
      country: 'India',
      memberId: 'IFSMHP-000002',
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(100_000);
  });
});
