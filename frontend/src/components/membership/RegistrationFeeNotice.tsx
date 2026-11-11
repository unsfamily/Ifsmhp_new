import type { RegistrationPolicy } from '../../services/membershipService';
import { isApplicationFeeExempt } from '../../domain/membershipFee';

/** Immediate fee signal tied to Professional Type — shown as soon as the applicant picks a role. */
export default function RegistrationFeeNotice({ policy, professionalType }: { policy: RegistrationPolicy; professionalType: string }) {
  if (!policy.applicationFeeEnabled) return null;
  const selected = professionalType.trim();
  const amount = `${policy.currency} ${policy.applicationFee}`;
  if (!selected) {
    return (
      <p role="status" className="mt-2 rounded-lg border border-forum-200 bg-forum-50 px-3 py-2 text-sm text-forum-900">
        Application registration fee: <span className="font-semibold">{amount}</span> for all professional types except Student (free).
        The amount is confirmed when you choose your professional type.
      </p>
    );
  }
  if (isApplicationFeeExempt(selected)) {
    return (
      <p role="status" className="mt-2 rounded-lg border border-success-600/20 bg-success-100 px-3 py-2 text-sm text-success-700">
        No application registration fee for students. Your membership application will not be charged.
      </p>
    );
  }
  return (
    <div role="status" className="mt-2 space-y-2 rounded-lg border border-brass-500/30 bg-brass-100/40 px-3 py-2 text-sm text-forum-900">
      <p>
        Application registration fee for {selected}: <span className="font-semibold">{amount}</span>.
        {policy.razorpayEnabled
          ? 'After you verify your email, pay this fee with Razorpay. You can use UPI without leaving the page. Membership is granted only after that payment succeeds and an administrator approves the application.'
          : 'Pay using the bank / UPI instructions below, then enter the UTR and upload a JPEG or PNG screenshot on this form. Membership is granted only after an administrator verifies that payment in the bank statement (students are free).'}
      </p>
      {!policy.razorpayEnabled && policy.paymentInstructions ? <p className="whitespace-pre-wrap rounded-md bg-paper p-3 text-ink">{policy.paymentInstructions}</p> : null}
    </div>
  );
}
