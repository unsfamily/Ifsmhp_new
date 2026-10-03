import { apiClient } from '../api/client';
import type { MembershipPolicy } from '../../../backend/domain/membership';
export type RegistrationPolicy = Pick<MembershipPolicy, 'requireProfile' | 'requireCredential' | 'referralCount' | 'referenceLetterCount' | 'applicationFeeEnabled' | 'applicationFee' | 'annualDuesEnabled' | 'annualDues' | 'currency' | 'waiversEnabled' | 'paymentInstructions'> & { revision: number };
export interface MembershipDetail {
  applicationId: string; applicationCode: string; status: string; memberId: string | null;
  archivedAt: string | null; archiveSuppressed: boolean; evidenceReviewedAt: string | null;
  policy: Partial<MembershipPolicy> & Pick<MembershipPolicy, 'paymentInstructions' | 'waiversEnabled'>;
  approvalProblems?: string[];
  referrals?: { id: string; name: string; email: string; organization: string }[];
  letters?: { id: string; fileId: string; name: string }[];
  charges: { id: string; kind: string; periodYear: number; amount: string; currency: string; dueAt: string; status: string; overdue: boolean;
    payments: { id: string; reference: string; createdAt: string; reversedAt: string | null; correctionReason: string | null }[];
    waivers: { id: string; status: string; reason: string; decisionReason: string | null; createdAt: string }[];
  }[];
}
const unwrap = <T,>(response: { data: { data: T } }) => response.data.data;
export const membershipService = {
  policy: (signal?: AbortSignal) => apiClient.get<{ data: RegistrationPolicy }>('/public/membership-policy', { signal }).then(unwrap),
  detail: (id?: string, signal?: AbortSignal) => apiClient.get<{ data: MembershipDetail }>(id ? `/admin/membership/${id}` : '/membership', { signal }).then(unwrap),
  action: (id: string | undefined, action: string, data: unknown) => apiClient.post<{ data: MembershipDetail }>(`${id ? `/admin/membership/${id}` : '/membership'}/${action}`, data).then(unwrap),
};
