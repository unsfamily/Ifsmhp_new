import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import sharp from 'sharp';
import {
  CERTIFICATE_AUTHORITY,
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
const GOLD = rgb(0.76, 0.62, 0.28);
const WHITE = rgb(1, 1, 1);
const PHOTO_FRAME = 1.6;

/**
 * Measured from the letterhead content stream. Each value sits on the printed
 * label's baseline; the cover is only as tall as that one line.
 */
const PHOTO = { x: 93.4, y: 61.6, width: 46.7, height: 46.7 };
const CARD_NAME = { x: 144.5, y: 93.7, size: 7.1, maxWidth: 168 };
const CARD_BRANCH = { x: 166.8, y: 75.5, size: 7, maxWidth: 145 };
const CARD_ID = { x: 214.1, y: 65.1, size: 7, maxWidth: 108 };
const CARD_VALID = { x: 160.5, y: 55.2, size: 7, maxWidth: 130 };

function letterheadPath(): string {
  const candidates = [
    path.resolve(__dirname, '../assets/certificates/ifsmhp-letterhead.pdf'),
    path.resolve(__dirname, '../../assets/certificates/ifsmhp-letterhead.pdf'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Membership certificate letterhead is not installed');
  return found;
}

const PAGE_CENTER = 595.2756 / 2;

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCentered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, maxWidth: number, leading: number, color: ReturnType<typeof rgb>): number {
  for (const line of wrapLines(text, font, size, maxWidth)) {
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, { x: PAGE_CENTER - width / 2, y, size, font, color });
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
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const name = holderName(person.fullName);
  const designation = designationLine(person);
  const measure = 470;
  let y = 700;

  y = drawCentered(page, admissionLabel(person.issuedAt), roman, 13, y, measure, 18, INK);
  y -= 8;
  y = drawCentered(page, CERTIFICATE_TITLE, romanBold, 24, y, measure, 28, NAVY);
  y -= 2;
  page.drawRectangle({ x: PAGE_CENTER - 92, y, width: 184, height: 1.4, color: BRASS });
  y -= 20;
  y = drawCentered(page, CERTIFICATE_AUTHORITY, roman, 12, y, measure, 16, BRASS);
  y -= 14;
  y = drawCentered(page, 'This is to certify that', romanItalic, 15, y, measure, 20, INK);
  y -= 8;
  y = drawCentered(page, name, romanBold, 22, y, measure, 26, NAVY);
  y -= 2;
  y = drawCentered(page, designation, romanItalic, 14, y, measure, 18, BRASS);
  y -= 12;
  for (const paragraph of certificateParagraphs(person)) {
    y = drawCentered(page, paragraph, roman, 13, y, measure, 17.5, INK);
    y -= 7;
  }
  y -= 2;
  for (const fact of certificateFacts(person)) {
    y = drawCentered(page, fact, romanBold, 13, y, measure, 16.5, NAVY);
  }

  cover(page, PHOTO.x, PHOTO.y, PHOTO.width, PHOTO.height);
  cover(page, CARD_NAME.x - 0.4, CARD_NAME.y - 1.6, CARD_NAME.maxWidth + 8, CARD_NAME.size + 2.2);
  cover(page, CARD_BRANCH.x - 0.4, CARD_BRANCH.y - 1.6, CARD_BRANCH.maxWidth, CARD_BRANCH.size + 2.2);
  cover(page, CARD_ID.x - 0.4, CARD_ID.y - 1.6, CARD_ID.maxWidth, CARD_ID.size + 2.2);
  cover(page, CARD_VALID.x - 0.4, CARD_VALID.y - 1.6, CARD_VALID.maxWidth, CARD_VALID.size + 2.2);

  const portraitBox = {
    x: PHOTO.x + PHOTO_FRAME,
    y: PHOTO.y + PHOTO_FRAME,
    width: PHOTO.width - PHOTO_FRAME * 2,
    height: PHOTO.height - PHOTO_FRAME * 2,
  };
  const image = await portraitImage(pdf, photo);
  if (image) {
    page.drawImage(image, portraitBox);
  } else {
    page.drawRectangle({ ...portraitBox, color: NAVY });
    const initials = cardInitials(name);
    const size = initials.length > 1 ? 13 : 16;
    const textWidth = sansBold.widthOfTextAtSize(initials, size);
    page.drawText(initials, {
      x: portraitBox.x + (portraitBox.width - textWidth) / 2,
      y: portraitBox.y + (portraitBox.height - size) / 2 + size * 0.28,
      size,
      font: sansBold,
      color: WHITE,
    });
  }
  page.drawRectangle({ ...PHOTO, borderColor: GOLD, borderWidth: 1.35 });

  drawFitted(page, name.toUpperCase(), sansBold, CARD_NAME.x, CARD_NAME.y, CARD_NAME.maxWidth, CARD_NAME.size, 5.5, NAVY);
  drawFitted(page, `: ${branchLabel(person.country)}`, sansBold, CARD_BRANCH.x, CARD_BRANCH.y, CARD_BRANCH.maxWidth, CARD_BRANCH.size, 5.5, NAVY);
  drawFitted(page, `: ${certificateText(person.memberId)}`, sansBold, CARD_ID.x, CARD_ID.y, CARD_ID.maxWidth, CARD_ID.size, 5.5, NAVY);
  drawFitted(page, `: ${validThroughLabel(person.approvedAt)}`, sansBold, CARD_VALID.x, CARD_VALID.y, CARD_VALID.maxWidth, CARD_VALID.size, 5.5, NAVY);

  pdf.setTitle(`${CERTIFICATE_TITLE} — ${person.memberId}`);
  pdf.setAuthor('International Forum for Scientists and Mental Health Professionals');
  pdf.setSubject(CERTIFICATE_TITLE);
  return Buffer.from(await pdf.save());
}

