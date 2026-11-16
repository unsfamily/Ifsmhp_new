import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import sharp from 'sharp';
import {
  CERTIFICATE_TITLE,
  admissionLabel,
  branchLabel,
  cardInitials,
  certificateFacts,
  certificateParagraphs,
  certificateText,
  designationLine,
  holderName,
  validThroughLabel,
  type CertificatePerson,
} from '../domain/membership-certificate';

const NAVY = rgb(0.09, 0.16, 0.29);
const INK = rgb(0.16, 0.2, 0.18);
const BRASS = rgb(0.45, 0.34, 0.14);
const WHITE = rgb(1, 1, 1);

const PHOTO = { x: 93.2, y: 61.4, width: 47.2, height: 47.2 };

function letterheadPath(): string {
  const candidates = [
    path.resolve(__dirname, '../assets/certificates/ifsmhp-letterhead.pdf'),
    path.resolve(__dirname, '../../assets/certificates/ifsmhp-letterhead.pdf'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Membership certificate letterhead is not installed');
  return found;
}

function drawWrapped(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, maxWidth: number, leading: number, color: ReturnType<typeof rgb>): number {
  const words = text.split(' ').filter(Boolean);
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y, size, font, color });
      y -= leading;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    page.drawText(line, { x, y, size, font, color });
    y -= leading;
  }
  return y;
}

function drawFitted(page: PDFPage, text: string, font: PDFFont, x: number, y: number, maxWidth: number, size: number, minSize: number, color: ReturnType<typeof rgb>): void {
  let fitted = size;
  while (fitted > minSize && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 0.25;
  const shown = font.widthOfTextAtSize(text, fitted) <= maxWidth ? text : `${text.slice(0, 28).trimEnd()}...`;
  page.drawText(shown, { x, y, size: fitted, font, color });
}

function cover(page: PDFPage, x: number, y: number, width: number, height: number): void {
  page.drawRectangle({ x, y, width, height, color: WHITE, borderWidth: 0 });
}

async function portraitImage(pdf: PDFDocument, photo: Buffer | undefined): Promise<PDFImage | null> {
  if (!photo?.length) return null;
  try {
    const jpeg = await sharp(photo, { failOn: 'none' }).rotate().resize(360, 360, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    return pdf.embedJpg(jpeg);
  } catch {
    return null;
  }
}

/**
 * Paints the holder's certificate onto the official letterhead.
 *
 * The page is the supplied letter pad. The large blank field receives the
 * admission text. The sample card's photograph, name, and membership number
 * are covered and replaced so the printed sample person never remains visible.
 */
export async function renderMembershipCertificate(person: CertificatePerson, photo?: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.load(await fsp.readFile(letterheadPath()));
  const page = pdf.getPages()[0];
  if (!page) throw new Error('Membership certificate letterhead has no page');
  const roman = await pdf.embedFont(StandardFonts.TimesRoman);
  const romanBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const romanItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const name = holderName(person.fullName);
  const designation = designationLine(person);
  const left = 54;
  const width = 488;
  let y = 668;

  page.drawText(admissionLabel(person.issuedAt), { x: left, y, size: 11, font: roman, color: INK });
  y = 638;
  page.drawText(CERTIFICATE_TITLE, { x: left, y, size: 20, font: romanBold, color: NAVY });
  y -= 8;
  page.drawRectangle({ x: left, y, width: 168, height: 1.2, color: BRASS });
  y -= 28;
  page.drawText('This is to certify that', { x: left, y, size: 12, font: romanItalic, color: INK });
  y -= 28;
  y = drawWrapped(page, name, romanBold, 18, left, y, width, 22, NAVY);
  y -= 4;
  y = drawWrapped(page, designation, romanItalic, 12, left, y, width, 16, BRASS);
  y -= 12;
  for (const paragraph of certificateParagraphs(person)) {
    y = drawWrapped(page, paragraph, roman, 11.5, left, y, width, 16, INK);
    y -= 8;
  }
  y -= 4;
  for (const fact of certificateFacts(person)) {
    page.drawText(fact, { x: left, y, size: 11, font: romanBold, color: NAVY });
    y -= 16;
  }

  cover(page, PHOTO.x - 0.4, PHOTO.y - 0.4, PHOTO.width + 0.8, PHOTO.height + 0.8);
  cover(page, 142, 82, 212, 20);
  cover(page, 163, 69, 180, 13);
  cover(page, 206, 57, 150, 16);
  cover(page, 155, 47, 160, 13);

  const image = await portraitImage(pdf, photo);
  if (image) {
    page.drawImage(image, PHOTO);
  } else {
    page.drawRectangle({ ...PHOTO, color: NAVY });
    const initials = cardInitials(name);
    const size = initials.length > 1 ? 14 : 16;
    const textWidth = sansBold.widthOfTextAtSize(initials, size);
    page.drawText(initials, {
      x: PHOTO.x + (PHOTO.width - textWidth) / 2,
      y: PHOTO.y + 16,
      size,
      font: sansBold,
      color: WHITE,
    });
  }

  drawFitted(page, name.toUpperCase(), sansBold, 144, 88, 198, 7.5, 5.5, NAVY);
  drawFitted(page, `: ${branchLabel(person.country)}`, sans, 166, 72.5, 168, 7, 5.5, INK);
  drawFitted(page, `: ${certificateText(person.memberId)}`, sansBold, 210, 61.2, 138, 7, 5.5, NAVY);
  drawFitted(page, `: ${validThroughLabel(person.approvedAt)}`, sans, 158, 51.2, 148, 7, 5.5, INK);

  pdf.setTitle(`${CERTIFICATE_TITLE} — ${person.memberId}`);
  pdf.setAuthor('International Forum for Scientists and Mental Health Professionals');
  pdf.setSubject(CERTIFICATE_TITLE);
  return Buffer.from(await pdf.save());
}

