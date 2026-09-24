import { effectiveSettings } from './settings.service';
import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../config';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { renderAnnouncement } from '../domain/announcement-markdown';

/**
 * Mail transport.
 *
 * SMTP credentials are read from config/env.ts and never leave the server —
 * they are not returned by any endpoint and are not part of any frontend bundle.
 * The OTP itself is likewise never included in an API response; the only paths
 * out of the process are a real email or, in development, the log below.
 */

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      // 465 is implicit TLS; 587 upgrades via STARTTLS.
      secure: (env.SMTP_PORT ?? 587) === 465,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendAnnouncementEmail(input: { to: string; subject: string; body: string; senderAsCRO: boolean; preview: boolean; unsubscribeUrl?: string; messageId: string }): Promise<boolean> {
  if (!env.mailConfigured) return false;
  const signature = input.senderAsCRO ? 'CRO Office' : 'Communications team';
  const footer = input.unsubscribeUrl ? `\n\nUnsubscribe from announcement emails: ${input.unsubscribeUrl}` : '';
  const result = await sendConfiguredMail({ from: env.mailFrom, to: input.to, messageId: input.messageId,
    subject: `${input.preview ? '[SAB Preview] ' : ''}${input.subject}`,
    text: `${input.body}\n\n${signature}${footer}`,
    html: `<div style="font-family:system-ui;max-width:640px">${renderAnnouncement(input.body)}<p>${signature}</p>${input.unsubscribeUrl ? `<p><a href="${input.unsubscribeUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">Unsubscribe from announcement emails</a></p>` : ''}</div>`,
  });
  if (!result.accepted?.length) throw new Error('SMTP did not accept the announcement recipient');
  return true;
}

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends mail. Three outcomes, and only one of them is silent.
 *
 *  - SMTP deliberately unset: development logs the message and continues, so
 *    local work and the seeded `@ifsmhp.local` accounts (which have no real
 *    mailbox) still function. Production treats it as misconfiguration.
 *  - Send succeeds: normal return.
 *  - SMTP set but the send FAILS: throws in every environment.
 *
 * That last case used to warn-and-return outside production, which meant a
 * transport with rejected credentials was indistinguishable from a working one
 * — the API answered "code sent" while nothing had been sent. A configured
 * transport that fails is a real error, and callers must be able to tell.
 */
async function deliver(mail: Mail, devFallbackDetail: string): Promise<void> {
  if (!env.mailConfigured) {
    if (env.isProduction) {
      logger.error('Mail is not configured; cannot deliver message', { to: mail.to });
      throw new ApiError(500, 'Email delivery is unavailable. Please try again later.');
    }
    logger.warn(`[mail:dev] SMTP NOT CONFIGURED — nothing was delivered. ${devFallbackDetail}`);
    return;
  }

  try {
    await sendConfiguredMail({ from: env.mailFrom, ...mail });
    logger.info('Email sent', { to: mail.to, subject: mail.subject });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('Email delivery failed', { to: mail.to, error: detail });
    throw new ApiError(
      502,
      "We couldn't send the code to that address. Check it is correct and try again.",
      [{ field: 'email', message: 'Delivery failed' }],
      { reason: 'delivery-failed' },
    );
  }
}

/**
 * Boot-time transport check. Never throws: a broken transport must be loud in
 * the log at startup rather than first discovered by a user waiting for a code.
 */
export async function verifyTransport(): Promise<void> {
  if (!env.mailConfigured) {
    logger.warn('[mail] SMTP is not configured — OTP codes will be logged, not emailed');
    return;
  }
  try {
    await getTransport().verify();
    logger.info('[mail] SMTP transport ready', { host: env.SMTP_HOST, user: env.SMTP_USER });
  } catch (error) {
    logger.error('[mail] SMTP transport UNUSABLE — OTP emails will fail', {
      host: env.SMTP_HOST,
      user: env.SMTP_USER,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type OtpPurpose = 'REGISTER' | 'LOGIN';

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: OtpPurpose,
  ttlMinutes: number,
): Promise<void> {
  const action = purpose === 'REGISTER' ? 'complete your IFSMHP registration' : 'sign in to IFSMHP';
  const subject = `${code} is your IFSMHP verification code`;

  const text = [
    `Your IFSMHP verification code is ${code}.`,
    ``,
    `Enter it to ${action}. The code expires in ${ttlMinutes} minutes.`,
    ``,
    `If you did not request this code you can ignore this email — no account changes have been made.`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#17251A">
      <h1 style="font-size:18px;margin:0 0 16px">IFSMHP verification code</h1>
      <p style="margin:0 0 20px;color:#405046">Enter this code to ${action}.</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 20px">${code}</p>
      <p style="margin:0 0 8px;color:#405046">The code expires in ${ttlMinutes} minutes.</p>
      <p style="margin:0;color:#718078;font-size:13px">
        If you did not request this code you can ignore this email — no account changes have been made.
      </p>
    </div>
  `.trim();

  // The code appears in the dev log only; it is never sent to the client.
  await deliver({ to: email, subject, text, html }, `OTP for ${email} (${purpose}) is ${code}`);
}

/**
 * Acknowledges an approved membership.
 *
 * Throws on a failed send, like every other message: the caller records the
 * failure and offers a retry rather than leaving the member wondering. Note
 * there is no password to communicate — members sign in with an emailed code.
 */
export async function sendApprovalEmail(
  email: string,
  fullName: string,
  memberId: string,
): Promise<void> {
  const subject = `Welcome to IFSMHP — your Member ID is ${memberId}`;

  const text = [
    `Dear ${fullName},`,
    ``,
    `Your IFSMHP membership application has been approved.`,
    ``,
    `Member ID: ${memberId}`,
    ``,
    `Your membership is now active. To sign in, go to the member portal and enter`,
    `this email address — we will send you a 6-digit code. There is no password to`,
    `remember.`,
    ``,
    `Welcome to the International Forum of Scientists and Mental Health Professionals.`,
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#17251A">
      <h1 style="font-size:18px;margin:0 0 16px">Your IFSMHP membership is approved</h1>
      <p style="margin:0 0 16px;color:#405046">Dear ${fullName}, your application has been reviewed and approved.</p>
      <div style="border:1px solid #d9e2dc;border-radius:8px;padding:16px;margin:0 0 20px">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#718078">Member ID</p>
        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:1px">${memberId}</p>
      </div>
      <p style="margin:0 0 8px;color:#405046">
        Your membership is now active. To sign in, enter this email address on the member
        portal and we will send you a 6-digit code — there is no password to remember.
      </p>
      <p style="margin:16px 0 0;color:#718078;font-size:13px">
        Welcome to the International Forum of Scientists and Mental Health Professionals.
      </p>
    </div>
  `.trim();

  await deliver({ to: email, subject, text, html }, `approval email for ${email} (${memberId})`);
}

export async function sendEventEmail(email: string, event: { title: string; date: Date | null; timeStart: string; timeEnd: string; timezone: string; location: string; cancellationReason: string | null }, cancelled: boolean): Promise<boolean> {
  if (!env.mailConfigured) return false;
  const subject = `${cancelled ? 'Event cancelled' : 'Event reminder'}: ${event.title}`;
  const text = [subject, `${event.date?.toISOString().slice(0, 10) ?? ''} ${event.timeStart} - ${event.timeEnd} (${event.timezone})`, event.location, cancelled ? event.cancellationReason || 'Please contact the organizer for further details.' : 'We look forward to seeing you.'].join('\n\n');
  const escaped = text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
  await sendConfiguredMail({ from: env.mailFrom, to: email, subject, text, html: `<div style="white-space:pre-wrap;font-family:system-ui">${escaped}</div>` });
  return true;
}

/** Operational notices contain a link, never private message or inquiry text. */
export async function sendAdminNotificationEmail(input: { to: string; title: string; link: string; key: string }): Promise<boolean> {
  if (!env.mailConfigured) return false;
  const origin = (env.ANNOUNCEMENT_WEB_URL ?? env.allowedOrigins[0]!).replace(/\/$/, '');
  const result = await sendConfiguredMail({ from: env.mailFrom, to: input.to, subject: input.title, text: `${input.title}\n\nReview this update: ${origin}${input.link}\n\nManage email preferences in your administrator profile.`, messageId: `<admin-notice-${input.key}@ifsmhp.local>` });
  if (!result.accepted?.length) throw new Error('SMTP did not accept the recipient');
  return true;
}

/** Apply current non-secret identity at delivery time, including worker retries. */
export async function sendConfiguredMail(mail: SendMailOptions) {
  const { communications: c } = await effectiveSettings();
  const address = env.mailFrom.match(/<([^<>]+)>\s*$/)?.[1] ?? env.mailFrom;
  const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return getTransport().sendMail({ ...mail, from: c.senderName ? { name: c.senderName, address } : env.mailFrom,
    ...(c.replyTo ? { replyTo: c.replyTo } : {}),
    ...(c.signature && typeof mail.text === 'string' ? { text: `${mail.text}\n\n${c.signature}` } : {}),
    ...(c.signature && typeof mail.html === 'string' ? { html: `${mail.html}<p style="white-space:pre-wrap">${escape(c.signature)}</p>` } : {}),
  });
}
