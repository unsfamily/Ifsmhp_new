import { createHmac, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { writeAudit } from './audit.service';
import { chargeStatus, lockApplication, membershipDetail } from './membership-policy.service';

const apiBase = 'https://api.razorpay.com/v1';
/** Razorpay Standard Checkout minimum order amount (₹1.00). */
const MIN_ORDER_PAISE = 100;

export function razorpayPaymentSignature(orderId: string, paymentId: string, secret: string) {
  return createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

export function razorpayWebhookSignature(body: Buffer, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function sameSignature(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export function moneyPaise(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

function authHeader() {
  return `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
}

async function razorpay<T>(path: string, init?: { method?: string; body?: string }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: init?.method ?? 'GET',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: init?.body,
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    logger.warn('Razorpay API request failed', { path, error: error instanceof Error ? error.message : 'unknown' });
    throw ApiError.serviceUnavailable('Online payment is temporarily unavailable.');
  }

  if (response.status === 401 || response.status === 403) {
    logger.warn('Razorpay API authentication failed', { path, status: response.status });
    // Do not return HTTP 401 to the browser — that would look like an IFSMHP session failure.
    throw ApiError.serviceUnavailable('Online payment credentials were rejected.');
  }

  if (!response.ok) {
    let description = 'Razorpay could not process the request.';
    try {
      const payload = (await response.json()) as { error?: { description?: string } };
      if (payload.error?.description) description = payload.error.description;
    } catch {
      // Keep the generic description when Razorpay returns a non-JSON body.
    }
    logger.warn('Razorpay API error', { path, status: response.status, description });
    throw ApiError.unprocessable(description);
  }

  return response.json() as Promise<T>;
}

interface RazorpayOrder { id: string; amount: number; currency: string }
interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  acquirer_data?: { rrn?: string; bank_transaction_id?: string };
}

async function loadOwnedCharge(userId: string, chargeId: string) {
  if (!env.razorpayConfigured || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw ApiError.unprocessable('Online payment is not available.');
  }
  const app = await prisma.membershipApplication.findFirst({
    where: { userId, user: { deletedAt: null } },
    include: { user: true, profile: true, charges: { where: { id: chargeId }, include: { payments: true, waivers: true } } },
  });
  const charge = app?.charges[0];
  if (!app || !charge) throw ApiError.notFound('Membership charge not found');
  if (app.status === 'REJECTED') throw ApiError.conflict('This application was rejected.');
  if (charge.currency !== 'INR') throw ApiError.unprocessable('Razorpay collects INR charges only.');
  if (chargeStatus(charge) !== 'UNPAID') throw ApiError.conflict('This charge is already settled.');
  return { app, charge };
}

function checkoutContact(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return undefined;
}

export async function startRazorpayCheckout(userId: string, chargeId: string) {
  const { app, charge } = await loadOwnedCharge(userId, chargeId);
  const amount = moneyPaise(charge.amount.toFixed(2));
  if (amount == null || amount < MIN_ORDER_PAISE) {
    throw ApiError.unprocessable('This charge cannot be paid online.');
  }

  const order = await razorpay<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: charge.id.slice(0, 40),
      notes: { chargeId: charge.id },
    }),
  });

  if (!order?.id || order.id.length > 25 || order.amount !== amount || order.currency !== 'INR') {
    throw ApiError.unprocessable('Razorpay could not start the payment.');
  }

  const returnPath = app.user.role === 'MEMBER' ? 'profile' : 'application';
  await prisma.membershipGatewayAttempt.create({ data: { chargeId: charge.id, txnId: order.id, returnPath } });

  const contact = checkoutContact(app.profile.phone);
  return {
    keyId: env.RAZORPAY_KEY_ID,
    orderId: order.id,
    amount,
    currency: 'INR' as const,
    name: 'IFSMHP',
    description: charge.kind === 'APPLICATION' ? 'Application fee' : 'Annual dues',
    prefill: {
      name: app.user.fullName,
      email: app.user.email,
      ...(contact ? { contact } : {}),
    },
  };
}

async function capturedPayment(orderId: string, paymentId: string, expectedPaise: number) {
  let payment = await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
  if (!payment || payment.order_id !== orderId || payment.currency !== 'INR' || payment.amount !== expectedPaise) {
    return null;
  }
  if (payment.status === 'authorized') {
    payment = await razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: 'POST',
      body: JSON.stringify({ amount: expectedPaise, currency: 'INR' }),
    });
  }
  if (!payment || payment.status !== 'captured' || payment.order_id !== orderId || payment.amount !== expectedPaise) {
    return null;
  }
  return payment;
}

async function recordCapturedPayment(orderId: string, paymentId: string) {
  const attempt = await prisma.membershipGatewayAttempt.findUnique({ where: { txnId: orderId }, include: { charge: true } });
  if (!attempt) return false;
  const expected = moneyPaise(attempt.charge.amount.toFixed(2));
  if (expected == null || expected < MIN_ORDER_PAISE) return false;
  const payment = await capturedPayment(orderId, paymentId, expected);
  if (!payment) return false;
  const reference = (payment.acquirer_data?.rrn || payment.acquirer_data?.bank_transaction_id || payment.id).slice(0, 191);
  try {
    await prisma.$transaction(async tx => {
      const app = await lockApplication(tx, attempt.charge.applicationId);
      const charge = app.charges.find(item => item.id === attempt.chargeId);
      if (!charge || charge.currency !== 'INR' || moneyPaise(charge.amount.toFixed(2)) !== expected) {
        throw ApiError.unprocessable('Payment amount does not match the charge.');
      }
      if (chargeStatus(charge) === 'UNPAID') {
        await tx.membershipPayment.create({
          data: { chargeId: charge.id, requestId: payment.id, reference, recordedBy: app.userId },
        });
        await writeAudit({
          actorId: app.userId,
          action: 'MembershipPaymentRecorded',
          entity: `MembershipApplication ${app.id}`,
          entityType: 'MembershipApplication',
          entityId: app.id,
          description: 'Razorpay confirmed the membership fee.',
        }, tx);
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return true;
    logger.warn('Razorpay payment was verified but not recorded', { orderId });
    return false;
  }
  return true;
}

export async function confirmRazorpayPayment(
  userId: string,
  chargeId: string,
  input: { orderId: string; paymentId: string; signature: string },
) {
  if (!env.RAZORPAY_KEY_SECRET) throw ApiError.unprocessable('Online payment is not available.');
  const attempt = await prisma.membershipGatewayAttempt.findUnique({
    where: { txnId: input.orderId },
    include: { charge: { include: { application: { select: { userId: true } } } } },
  });
  if (!attempt || attempt.chargeId !== chargeId || attempt.charge.application.userId !== userId) {
    throw ApiError.notFound('Payment order not found');
  }
  if (!sameSignature(razorpayPaymentSignature(input.orderId, input.paymentId, env.RAZORPAY_KEY_SECRET), input.signature)) {
    throw ApiError.badRequest('Payment could not be verified.');
  }
  const recorded = await recordCapturedPayment(input.orderId, input.paymentId);
  if (!recorded) throw ApiError.unprocessable('Payment could not be verified.');
  return membershipDetail(userId, userId);
}

export async function handleRazorpayWebhook(rawBody: Buffer, signature: string) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !sameSignature(razorpayWebhookSignature(rawBody, secret), signature)) return false;
  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try {
    event = JSON.parse(rawBody.toString('utf8')) as typeof event;
  } catch {
    return false;
  }
  if (event.event !== 'payment.captured' && event.event !== 'order.paid') return true;
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) return true;
  await recordCapturedPayment(payment.order_id, payment.id);
  return true;
}
