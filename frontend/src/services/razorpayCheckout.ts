import type { RazorpayCheckout } from './membershipService';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailure {
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void;
}

type RazorpayConstructor = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: RazorpayCheckout['prefill'];
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** The checkout closed without a payment, or could not open. The message is safe to show to the applicant. */
export class RazorpayCheckoutError extends Error {}

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new RazorpayCheckoutError('Razorpay checkout could not be loaded.')));
    script.onerror = () => reject(new RazorpayCheckoutError('Razorpay checkout could not be loaded.'));
    document.body.appendChild(script);
  });
}

/**
 * Opens Razorpay Standard Checkout on this page. UPI apps can open from the modal.
 *
 * A failed attempt does not end the checkout: Razorpay keeps its window open and lets the applicant
 * retry on the same order, and a retry that succeeds must still reach the server. So the result is
 * decided only when Razorpay reports a payment, or when the window closes without one.
 */
export async function openRazorpayCheckout(checkout: RazorpayCheckout) {
  const Razorpay = await loadCheckout();
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let lastFailure = '';
    const instance = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      handler: resolve,
      modal: {
        // Ignored if the payment already succeeded: a promise settles once.
        ondismiss: () => reject(new RazorpayCheckoutError(lastFailure ? `Payment was not completed. Razorpay reported: ${lastFailure}` : 'Payment was not completed.')),
      },
    });
    instance.on('payment.failed', (response) => {
      lastFailure = (response.error?.description || response.error?.reason || 'Payment failed.').slice(0, 200);
    });
    instance.open();
  });
}
