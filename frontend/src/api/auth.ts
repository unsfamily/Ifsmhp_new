import { apiClient, setAccessToken, getSessionGeneration } from './client';

export type Role = 'APPLICANT' | 'MEMBER' | 'ADMIN';
export type Status = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: Status;
  memberId?: string | null;
  professionalType?: string | null;
  profile?: unknown;
}

interface Envelope<T> {
  success: true;
  data: T;
  message: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  professionalType: string;
  institution: string;
  credentials: string;
  education: string;
  researchInterests: string;
  documents: RegistrationDocumentClaim[];
  agreeTerms: true;
}

export type RegistrationDocumentKind = 'CV' | 'CREDENTIAL';

export interface RegistrationDocumentClaim {
  kind: RegistrationDocumentKind;
  fileId: string;
  claimToken: string;
}

export interface RegistrationDocumentUpload {
  id: string;
  claimToken: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export type OtpPurpose = 'REGISTER' | 'LOGIN';

export interface OtpRequestResult {
  email: string;
  /** ISO timestamp after which the code stops working. */
  expiresAt: string;
  /** Seconds the user must wait before a resend is accepted. */
  resendAfterSeconds: number;
  /**
   * ISO instant the cooldown ends. Preferred over the duration above because an
   * absolute deadline stays correct across a refresh and a backgrounded tab.
   */
  resendAfterAt: string;
  /**
   * Demo code hint shown only when the mock backend handled the request. Real
   * backends never set this. When present, the UI can surface a banner that
   * reveals the verification code to users running without a real email
   * pipeline so the flow doesn't appear broken.
   */
  demoCodeHint?: string;
}

/** Password sign-in. Retained for administrators only. */
export async function login(payload: { email: string; password: string; remember?: boolean }) {
  const generation = getSessionGeneration();
  const response = await apiClient.post<Envelope<{ accessToken: string; user: SessionUser }>>('/auth/login', payload);
  if (generation !== getSessionGeneration()) throw new Error('The session changed. Please sign in again.');
  setAccessToken(response.data.data.accessToken);
  return response.data.data.user;
}

/**
 * Requests a one-time code. Also the resend call — the backend cooldown makes
 * repeating it safe.
 *
 * For LOGIN the address alone is enough; for REGISTER the whole application is
 * sent up front so it can be validated before any email goes out, and held
 * server-side until the code is confirmed.
 */
export async function requestOtp(
  input: { purpose: 'LOGIN'; email: string } | (RegisterPayload & { purpose: 'REGISTER' }),
) {
  const response = await apiClient.post<Envelope<OtpRequestResult>>('/auth/otp/request', input);
  return response.data.data;
}

export async function uploadRegistrationDocument(file: File) {
  const body = new FormData();
  body.append('file', file);
  const response = await apiClient.post<Envelope<RegistrationDocumentUpload>>('/files/registration', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function removeRegistrationDocument(payload: { id: string; claimToken: string }) {
  await apiClient.delete('/files/registration/' + payload.id, { data: { claimToken: payload.claimToken } });
}

/**
 * Re-sends the code for an attempt already under way, addressed by email alone.
 *
 * Separate from `requestOtp` because a REGISTER resend must work after a page
 * refresh, when the application form is empty — the backend recovers the draft
 * from the outstanding code.
 */
export async function resendOtp(payload: { purpose: OtpPurpose; email: string }) {
  const response = await apiClient.post<Envelope<OtpRequestResult>>('/auth/otp/resend', payload);
  return response.data.data;
}

/** Verifies a code, completing either registration or login. */
export async function verifyOtp(payload: { purpose: OtpPurpose; email: string; code: string }) {
  const generation = getSessionGeneration();
  const response = await apiClient.post<Envelope<{ accessToken: string; user: SessionUser }>>(
    '/auth/otp/verify',
    payload,
  );
  if (generation !== getSessionGeneration()) throw new Error('The session changed. Please sign in again.');
  setAccessToken(response.data.data.accessToken);
  return response.data.data.user;
}

export async function currentUser() {
  const response = await apiClient.get<Envelope<{ user: SessionUser }>>('/auth/me');
  return response.data.data.user;
}

export async function logout() {
  setAccessToken(null);
  await apiClient.post('/auth/logout').catch(() => undefined);
}
