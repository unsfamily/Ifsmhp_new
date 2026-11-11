import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { moneyPaise, razorpayPaymentSignature, razorpayWebhookSignature, sameSignature } from '../services/razorpay.service';

describe('Razorpay checkout verification', () => {
  it('signs the order and payment the way Razorpay Checkout does', () => {
    const secret = 'key-secret';
    const expected = createHmac('sha256', secret).update('order_123|pay_456').digest('hex');
    expect(razorpayPaymentSignature('order_123', 'pay_456', secret)).toBe(expected);
    expect(sameSignature(expected, expected)).toBe(true);
    expect(sameSignature(expected, razorpayPaymentSignature('order_123', 'pay_999', secret))).toBe(false);
  });

  it('signs the raw webhook body', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const secret = 'webhook-secret';
    expect(razorpayWebhookSignature(body, secret)).toBe(createHmac('sha256', secret).update(body).digest('hex'));
  });

  it('converts the charge amount to paise and rejects invalid decimals', () => {
    expect(moneyPaise('100.00')).toBe(10000);
    expect(moneyPaise('100')).toBe(10000);
    expect(moneyPaise('1.00')).toBe(100);
    expect(moneyPaise('100.5')).toBe(10050);
    expect(moneyPaise('100.001')).toBeNull();
    expect(moneyPaise('abc')).toBeNull();
  });
});
