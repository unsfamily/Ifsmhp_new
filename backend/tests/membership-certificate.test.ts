import { describe, expect, it } from 'vitest';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import {
  admissionDateLine,
  admissionFilename,
  admissionLabel,
  admissionMembershipLine,
  admissionProfession,
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
import { renderAdmissionCertificate, renderMembershipCertificate } from '../services/membership-certificate-document';

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
    expect(admissionProfession(sarah)).toBe('Research Scholar / Scientist');
    expect(admissionProfession({ ...sarah, professionalType: 'Student', professionalTitle: 'Clinical Research Scientist' })).toBe('Student');
    expect(admissionMembershipLine(sarah.memberId)).toBe('Membership Number IFSMHP-000001');
    expect(admissionDateLine(admitted)).toBe('On 15 January 2026');
    expect(designationLine(sarah)).toBe('Clinical Research Scientist, Stanford Center for Digital Mental Health');
    expect(admissionLabel(admitted)).toBe('15 January 2026');
    expect(validThroughLabel(admitted)).toBe('January 2027');
    expect(branchLabel('India')).toBe('India');
    expect(branchLabel(null)).toBe('International');
    expect(cardInitials('Dr. Sarah Chen')).toBe('SC');
    expect(certificateFilename('IFSMHP-000001')).toBe('IFSMHP-Membership-Certificate-IFSMHP-000001.pdf');
    expect(admissionFilename('IFSMHP-000001')).toBe('IFSMHP-Admission-Certificate-IFSMHP-000001.pdf');
  });

  it('folds characters the certificate font cannot draw and keeps the admission wording', () => {
    expect(certificateText('José  Álvarez')).toBe('Jose Alvarez');
    expect(holderName('   ')).toBe('Member');
    const paragraphs = certificateParagraphs(sarah);
    const body = paragraphs.join('\n');
    expect(paragraphs[0]).toContain('duly elected and admitted as a Member');
    expect(body).toContain('learned societies throughout the world');
    expect(body).toContain('distinguished contribution to scientific inquiry and the practice of mental health');
    expect(body).toContain('seated at Chennai, India');
    expect(body).not.toContain('Tambaram');
    expect(body).toContain('valid through January 2027');
    expect(body).toContain('Chief Research Officer');
    const facts = certificateFacts(sarah);
    expect(facts.join('\n')).toContain('IFSMHP-000001');
    expect(facts.join('\n')).toContain('United States');
    expect(facts[facts.length - 1]).toBe('Date of admission  15 January 2026');
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

  it('left-aligns the card name with the Branch label', async () => {
    const pdf = await renderMembershipCertificate({
      ...sarah,
      fullName: 'Nirushan Tamilselvan',
      professionalTitle: 'Student',
      professionalType: 'Student',
      institution: 'University',
      country: null,
      memberId: 'IFSMHP-000029',
    });
    const document = await PDFDocument.load(pdf);
    expect(document.getPageCount()).toBe(1);
    const admissionPdf = await renderAdmissionCertificate({
      ...sarah,
      fullName: 'Nirushan Tamilselvan',
      professionalTitle: 'Student',
      professionalType: 'Student',
      institution: 'University',
      country: null,
      memberId: 'IFSMHP-000029',
    });
    const admissionDocument = await PDFDocument.load(admissionPdf);
    expect(admissionDocument.getPageCount()).toBe(1);
    const admission = pageText(admissionDocument, 0);
    expect(admission).toContain('1 0 0 1 59.527557 532.0007 Tm');
    expect(admission).toContain('1 0 0 1 59.527557 448.0007 Tm');
    expect(admission).toContain('1 0 0 1 59.527557 326.862 Tm');
    expect(admission).toContain('1 0 0 1 59.527557 312.612 Tm');
    expect(admission).toContain('/Lato-BlackItalic');
    expect(admission).not.toContain('(\\000\\016\\000\\n\\000\\017\\000\\020\\000\\017\\000\\021');
    const page = document.getPages()[0];
    if (!page) throw new Error('Certificate has no page');
    const contents = page.node.Contents();
    const refs = contents && 'asArray' in contents ? contents.asArray() : [contents];
    let stream = '';
    for (const ref of refs) {
      if (!ref) continue;
      const decoded = decodePDFRawStream(document.context.lookup(ref)).decode();
      stream += Buffer.from(decoded).toString('latin1');
    }
    const nameAt = stream.indexOf(`<${Buffer.from('NIRUSHAN TAMILSELVAN').toString('hex').toUpperCase()}>`);
    expect(nameAt).toBeGreaterThan(0);
    const placed = stream.slice(Math.max(0, nameAt - 80), nameAt);
    const position = placed.match(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/);
    expect(position?.[1]).toBe('144.5');
  });
});

function pageText(document: PDFDocument, index: number): string {
  const page = document.getPages()[index];
  if (!page) throw new Error(`Certificate has no page ${index}`);
  const contents = page.node.Contents();
  const refs = contents && 'asArray' in contents ? contents.asArray() : [contents];
  let stream = '';
  for (const ref of refs) {
    if (!ref) continue;
    const decoded = decodePDFRawStream(document.context.lookup(ref)).decode();
    stream += Buffer.from(decoded).toString('latin1');
  }
  return stream;
}
