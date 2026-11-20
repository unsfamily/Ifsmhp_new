import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib';
import sharp from 'sharp';
import {
  CERTIFICATE_AUTHORITY,
  CERTIFICATE_TITLE,
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

/**
 * Measured from the current letterhead. Each value sits on the printed
 * label's baseline; the cover is only as tall as that one line.
 * The citation must stay below the header rule (about y=717) and above
 * the dotted cut line (about y=175).
 *
 * The printed card frame is x=90..317.3, y=17..156.5. Covers stay inside
 * that stroke. MEMBER is the gold word at x=189.66; the holder name shares
 * that left edge when it fits, and drops clear of the word.
 */
const CARD_INNER_RIGHT = 313;
const PHOTO_SLOT = { x: 93.4, y: 61.6, width: 46.75, height: 46.75 };
const PHOTO_DROP = 4;
const MEMBER_LEFT = 189.66;
const NAME_ROW_LEFT = 144.5;
const CARD_NAME = { x: NAME_ROW_LEFT, y: 89.2, size: 7.1, maxWidth: 168 };
const CARD_BRANCH = { x: 166.8, y: 75.5, size: 7, maxWidth: 145 };
const CARD_ID = { x: 214.1, y: 65.1, size: 7, maxWidth: 98 };
const CARD_VALID = { x: 160.5, y: 55.2, size: 7, maxWidth: 150 };

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

/** Both edges of every line except the last share the measure. The last line stays left aligned. */
function drawJustified(page: PDFPage, text: string, font: PDFFont, size: number, y: number, maxWidth: number, leading: number, color: ReturnType<typeof rgb>): number {
  const left = PAGE_CENTER - maxWidth / 2;
  const lines = wrapLines(text, font, size, maxWidth);
  lines.forEach((line, index) => {
    const words = line.split(' ').filter(Boolean);
    const last = index === lines.length - 1 || words.length < 2;
    if (last) {
      page.drawText(line, { x: left, y, size, font, color });
    } else {
      const wordsWidth = words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0);
      const gap = (maxWidth - wordsWidth) / (words.length - 1);
      let x = left;
      for (const word of words) {
        page.drawText(word, { x, y, size, font, color });
        x += font.widthOfTextAtSize(word, size) + gap;
      }
    }
    y -= leading;
  });
  return y;
}

const HEAD_OFFICE = 'Head office: IFSMHP Building 1B, Kannamal Nagar, Chennai, Tamil Nadu, India, PIN - 600044';

function drawHeadOffice(page: PDFPage, font: PDFFont): void {
  paintWhite(page, 140, 744, 430, 32);
  let size = 8;
  while (size > 6 && font.widthOfTextAtSize(HEAD_OFFICE, size) > 410) size -= 0.25;
  const width = font.widthOfTextAtSize(HEAD_OFFICE, size);
  page.drawText(HEAD_OFFICE, { x: PAGE_CENTER - width / 2, y: 754, size, font, color: INK });
}

async function organisationMark(pdf: PDFDocument): Promise<PDFImage | null> {
  const candidates = [
    path.resolve(__dirname, '../assets/certificates/ifsmhp-logo.png'),
    path.resolve(__dirname, '../../assets/certificates/ifsmhp-logo.png'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) return null;
  return pdf.embedPng(await fsp.readFile(found));
}

/** Replaces the printed director wordmark and DIRECTOR line with a round logo seal. The signature stays. */
async function drawRoundSeal(page: PDFPage, pdf: PDFDocument): Promise<void> {
  paintWhite(page, 356, 106.9, 158, 22);
  paintWhite(page, 408, 68.9, 52, 12);
  const centerX = 500;
  const centerY = 97.9;
  const radius = 22;
  page.drawEllipse({ x: centerX, y: centerY, xScale: radius, yScale: radius, color: WHITE, borderColor: NAVY, borderWidth: 1.35 });
  const logo = await organisationMark(pdf);
  if (!logo) return;
  const mark = radius * 1.35;
  page.drawImage(logo, { x: centerX - mark / 2, y: centerY - mark / 2, width: mark, height: mark });
}

function drawFitted(page: PDFPage, text: string, font: PDFFont, x: number, y: number, maxWidth: number, size: number, minSize: number, color: ReturnType<typeof rgb>): void {
  let fitted = size;
  while (fitted > minSize && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 0.25;
  const shown = font.widthOfTextAtSize(text, fitted) <= maxWidth ? text : `${text.slice(0, 28).trimEnd()}...`;
  page.drawText(shown, { x, y, size: fitted, font, color });
}

function paintWhite(page: PDFPage, x: number, y: number, width: number, height: number): void {
  if (width <= 0 || height <= 0) return;
  page.drawRectangle({ x, y, width, height, color: WHITE, borderWidth: 0 });
}

function cover(page: PDFPage, x: number, y: number, width: number, height: number): void {
  const right = Math.min(x + width, CARD_INNER_RIGHT);
  paintWhite(page, x, y, right - x, height);
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
  let y = 692;

  drawHeadOffice(page, roman);
  await drawRoundSeal(page, pdf);
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
  certificateParagraphs(person).forEach((paragraph, index) => {
    const justified = index === 1 || index === 2;
    y = justified
      ? drawJustified(page, paragraph, roman, 13, y, measure, 17.5, INK)
      : drawCentered(page, paragraph, roman, 13, y, measure, 17.5, INK);
    y -= 7;
  });
  y -= 2;
  for (const fact of certificateFacts(person)) {
    y = drawCentered(page, fact, romanBold, 13, y, measure, 16.5, NAVY);
  }

  cover(page, PHOTO_SLOT.x - 1.2, PHOTO_SLOT.y - 1.2, PHOTO_SLOT.width + 2.4, PHOTO_SLOT.height + 2.4);
  cover(page, CARD_NAME.x - 0.4, 87, CARD_NAME.maxWidth, 13);
  cover(page, CARD_BRANCH.x - 0.4, CARD_BRANCH.y - 1.6, CARD_BRANCH.maxWidth, CARD_BRANCH.size + 2.2);
  cover(page, CARD_ID.x - 0.4, CARD_ID.y - 1.6, CARD_ID.maxWidth, CARD_ID.size + 2.2);
  cover(page, CARD_VALID.x - 0.4, CARD_VALID.y - 1.6, CARD_VALID.maxWidth, CARD_VALID.size + 2.2);

  const portraitBox = {
    x: PHOTO_SLOT.x,
    y: PHOTO_SLOT.y - PHOTO_DROP,
    width: PHOTO_SLOT.width,
    height: PHOTO_SLOT.height,
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

  const cardName = name.toUpperCase();
  const underMemberWidth = CARD_INNER_RIGHT - MEMBER_LEFT;
  const nameFitsUnderMember = sansBold.widthOfTextAtSize(cardName, CARD_NAME.size) <= underMemberWidth;
  drawFitted(
    page,
    cardName,
    sansBold,
    nameFitsUnderMember ? MEMBER_LEFT : CARD_NAME.x,
    CARD_NAME.y,
    nameFitsUnderMember ? underMemberWidth : CARD_INNER_RIGHT - CARD_NAME.x,
    CARD_NAME.size,
    5.5,
    NAVY,
  );
  drawFitted(page, `: ${branchLabel(person.country)}`, sansBold, CARD_BRANCH.x, CARD_BRANCH.y, CARD_BRANCH.maxWidth, CARD_BRANCH.size, 5.5, NAVY);
  drawFitted(page, `: ${certificateText(person.memberId)}`, sansBold, CARD_ID.x, CARD_ID.y, CARD_ID.maxWidth, CARD_ID.size, 5.5, NAVY);
  drawFitted(page, `: ${validThroughLabel(person.approvedAt)}`, sansBold, CARD_VALID.x, CARD_VALID.y, CARD_VALID.maxWidth, CARD_VALID.size, 5.5, NAVY);

  pdf.setTitle(`${CERTIFICATE_TITLE} — ${person.memberId}`);
  pdf.setAuthor('International Forum for Scientists and Mental Health Professionals');
  pdf.setSubject(CERTIFICATE_TITLE);
  return Buffer.from(await pdf.save());
}

