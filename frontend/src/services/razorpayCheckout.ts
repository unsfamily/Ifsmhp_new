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

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay checkout could not be loaded.')));
    script.onerror = () => reject(new Error('Razorpay checkout could not be loaded.'));
    document.body.appendChild(script);
  });
}

/** Opens Razorpay Standard Checkout on this page. UPI apps can open from the modal. */
export async function openRazorpayCheckout(checkout: RazorpayCheckout) {
  const Razorpay = await loadCheckout();
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let settled = false;
    const instance = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      handler: (response) => {
        settled = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!settled) reject(new Error('Payment was not completed.'));
        },
      },
    });
    instance.on('payment.failed', (response) => {
      if (settled) return;
      settled = true;
      const detail = response.error?.description || response.error?.reason || 'Payment failed.';
      reject(new Error(detail));
    });
    instance.open();
  });
}
