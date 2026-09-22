import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig, type AxiosResponse } from 'axios';

/** Failure envelope returned by the API (spec §40). */
export interface ApiFailure {
  success: false;
  message: string;
  errors: { field: string; message: string }[];
  /** Machine-readable detail — branch on this rather than on message text. */
  meta?: Record<string, string | number | boolean>;
  requestId?: string;
}

/** Normalized error the UI can rely on regardless of what went wrong. */
export interface NormalizedApiError {
  status: number | null;
  message: string;
  fieldErrors: Record<string, string>;
  /**
   * Why the request failed, when the server said so: 'cooldown',
   * 'resend-limit', 'attempt-limit', 'incorrect', 'expired', 'delivery-failed'.
   */
  reason?: string;
  meta?: Record<string, string | number | boolean>;
  requestId?: string;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';
let accessToken: string | null = localStorage.getItem('ifsmhp.accessToken');
const MOCK_USER_KEY = 'ifsmhp.mockUser';

type MockSessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'APPLICANT' | 'MEMBER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';
  memberId?: string | null;
  professionalType?: string | null;
};

const MOCK_ADMIN: MockSessionUser = {
  id: 'mock-admin-001',
  email: 'admin@ifsmhp.org',
  fullName: 'Chief Research Office',
  role: 'ADMIN',
  status: 'ACTIVE',
  professionalType: 'Administrator',
};

const MOCK_MEMBER: MockSessionUser = {
  id: 'mock-member-001',
  email: 'member@ifsmhp.org',
  fullName: 'Dr. Jane Researcher',
  role: 'MEMBER',
  status: 'ACTIVE',
  memberId: 'IFSMHP-00421',
  professionalType: 'Clinical Psychologist',
};

const MOCK_OTP_RESULT = {
  email: 'user@ifsmhp.org',
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  resendAfterSeconds: 30,
  resendAfterAt: new Date(Date.now() + 30 * 1000).toISOString(),
};

const MOCK_VALID_OTP = '123456';

const NETWORK_ERROR_CODES = new Set([
  'ERR_NETWORK',
  'ECONNREFUSED',
  'ERR_CONNECTION_REFUSED',
  'ERR_EMPTY_RESPONSE',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNABORTED',
  'ERR_CANCELED',
]);

const DRAFT_REGISTRATION_KEY = 'ifsmhp.draftRegistration';

type DraftRegistration = {
  email: string;
  fullName?: string;
  createdAt: number;
};

function readMockUser(): MockSessionUser | null {
  try {
    const raw = localStorage.getItem(MOCK_USER_KEY);
    return raw ? (JSON.parse(raw) as MockSessionUser) : null;
  } catch {
    return null;
  }
}

function writeMockUser(user: MockSessionUser | null) {
  if (user) localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(MOCK_USER_KEY);
}

function readDraftRegistration(): DraftRegistration | null {
  try {
    const raw = localStorage.getItem(DRAFT_REGISTRATION_KEY);
    return raw ? (JSON.parse(raw) as DraftRegistration) : null;
  } catch {
    return null;
  }
}

function writeDraftRegistration(draft: DraftRegistration | null) {
  if (draft) localStorage.setItem(DRAFT_REGISTRATION_KEY, JSON.stringify(draft));
  else localStorage.removeItem(DRAFT_REGISTRATION_KEY);
}

function buildMockResponse<T>(config: AxiosRequestConfig, status: number, data: T): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : `${status}`,
    headers: {},
    config: config as AxiosResponse<T>['config'],
  };
}

function resolveMockUserFromBearer(token: string | undefined): MockSessionUser | null {
  if (!token) return null;
  if (token.startsWith('mock-admin-')) return MOCK_ADMIN;
  if (token.startsWith('mock-member-')) return MOCK_MEMBER;
  return readMockUser();
}

/**
 * True when the request failed for a pure transport-level reason (no HTTP
 * response was ever received from a server). This is when the mock fallback
 * kicks in — real 4xx/5xx responses are never overridden.
 */
function isNetworkFailure(error: AxiosError): boolean {
  if (error.response) return false;
  if (error.code && NETWORK_ERROR_CODES.has(error.code)) return true;
  if (typeof (error as unknown as { isAxiosError?: boolean }).isAxiosError === 'boolean' && !error.response) {
    return true;
  }
  return !error.response && !!error.request;
}

/**
 * Handles auth + file endpoints when the backend is unreachable (pure network
 * failure, no HTTP response). This keeps the login flow, session restore, and
 * member/admin portals functional in frontend-only demos. Real server responses
 * always win — mock fallback is never used when a real 4xx/5xx is returned.
 */
function tryMockFallback(error: AxiosError): AxiosResponse | null {
  if (!isNetworkFailure(error)) return null;
  const config = error.config;
  if (!config) return null;
  const rawUrl = config.url ?? '';
  const url = rawUrl.startsWith('http') ? new URL(rawUrl).pathname : rawUrl;
  const method = (config.method ?? 'get').toLowerCase();
  const body = (config.data as unknown) ?? {};
  const parsedBody: Record<string, unknown> =
    typeof body === 'string'
      ? (() => {
          try {
            return JSON.parse(body);
          } catch {
            return {};
          }
        })()
      : (body as Record<string, unknown>);

  const authHeader =
    (config.headers as { Authorization?: string } | undefined)?.Authorization ?? undefined;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (method === 'post' && url.endsWith('/auth/refresh')) {
    const token = bearerToken
      ? bearerToken
      : 'mock-member-' + Math.random().toString(36).slice(2, 10);
    return buildMockResponse(config, 200, {
      success: true,
      data: { accessToken: token },
      message: 'Token refreshed (mock backend).',
    });
  }

  if (method === 'post' && url.endsWith('/auth/login')) {
    const email = String(parsedBody.email ?? '').toLowerCase();
    const password = String(parsedBody.password ?? '');
    if (password.length < 8) return null;

    let user: MockSessionUser;
    let token: string;
    if (email === 'admin@ifsmhp.org' || email.includes('admin') || email.includes('cro@')) {
      user = { ...MOCK_ADMIN, email: email || MOCK_ADMIN.email };
      token = 'mock-admin-' + Math.random().toString(36).slice(2, 10);
    } else {
      user = { ...MOCK_MEMBER, email: email || MOCK_MEMBER.email };
      token = 'mock-member-' + Math.random().toString(36).slice(2, 10);
    }
    setAccessToken(token);
    writeMockUser(user);
    return buildMockResponse(config, 200, {
      success: true,
      data: { accessToken: token, user },
      message: 'Signed in (mock backend).',
    });
  }

  if (method === 'post' && url.endsWith('/auth/otp/request')) {
    const email = String(parsedBody.email ?? MOCK_OTP_RESULT.email).toLowerCase();
    const purpose = String(parsedBody.purpose ?? 'LOGIN').toUpperCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const resendAfterAt = new Date(Date.now() + 30 * 1000).toISOString();

    if (purpose === 'REGISTER') {
      writeDraftRegistration({
        email,
        fullName: typeof parsedBody.fullName === 'string' ? parsedBody.fullName : undefined,
        createdAt: Date.now(),
      });
    } else {
      writeDraftRegistration(null);
    }

    return buildMockResponse(config, 200, {
      success: true,
      data: {
        email,
        expiresAt,
        resendAfterSeconds: 30,
        resendAfterAt,
        demoCodeHint: MOCK_VALID_OTP,
      },
      message: 'One-time code sent (mock backend — use 123456).',
    });
  }

  if (method === 'post' && url.endsWith('/auth/otp/resend')) {
    const email = String(parsedBody.email ?? readDraftRegistration()?.email ?? MOCK_OTP_RESULT.email).toLowerCase();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const resendAfterAt = new Date(Date.now() + 30 * 1000).toISOString();
    return buildMockResponse(config, 200, {
      success: true,
      data: {
        email,
        expiresAt,
        resendAfterSeconds: 30,
        resendAfterAt,
        demoCodeHint: MOCK_VALID_OTP,
      },
      message: 'Code re-sent (mock backend — use 123456).',
    });
  }

  if (method === 'post' && url.endsWith('/auth/otp/verify')) {
    const code = String(parsedBody.code ?? '');
    const email = String(parsedBody.email ?? '').toLowerCase();
    const purpose = String(parsedBody.purpose ?? 'LOGIN').toUpperCase();
    if (code !== MOCK_VALID_OTP) {
      return buildMockResponse(config, 400, {
        success: false,
        message: 'The code you entered is incorrect. Try 123456 in demo mode.',
        errors: [{ field: 'code', message: 'Invalid or expired code.' }],
        meta: { reason: 'incorrect' },
      });
    }
    const isAdmin = email === 'admin@ifsmhp.org' || email.includes('admin');
    const baseRole: 'APPLICANT' | 'MEMBER' | 'ADMIN' =
      purpose === 'REGISTER' ? 'APPLICANT' : isAdmin ? 'ADMIN' : 'MEMBER';
    const defaults = isAdmin ? MOCK_ADMIN : MOCK_MEMBER;
    const draft = readDraftRegistration();
    const user: MockSessionUser = {
      ...defaults,
      id: `mock-${baseRole.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`,
      email: email || defaults.email,
      fullName: draft?.fullName || defaults.fullName,
      role: baseRole,
      status: purpose === 'REGISTER' ? 'PENDING' : 'ACTIVE',
      memberId: baseRole === 'MEMBER' ? `IFSMHP-${String(Math.floor(Math.random() * 90000) + 10000)}` : baseRole === 'APPLICANT' ? null : defaults.memberId,
    };
    const token = `mock-${user.role.toLowerCase()}-${Math.random().toString(36).slice(2, 10)}`;
    setAccessToken(token);
    writeMockUser(user);
    if (purpose === 'REGISTER') writeDraftRegistration(null);
    return buildMockResponse(config, 200, {
      success: true,
      data: { accessToken: token, user },
      message: purpose === 'REGISTER'
        ? 'Registration complete — application under review (mock backend).'
        : 'Verified and signed in (mock backend).',
    });
  }

  if (method === 'get' && url.endsWith('/auth/me')) {
    const user = resolveMockUserFromBearer(bearerToken);
    if (!user) {
      return buildMockResponse(config, 401, {
        success: false,
        message: 'No active session.',
        errors: [{ field: 'session', message: 'Session expired or missing.' }],
        meta: { reason: 'expired' },
      });
    }
    return buildMockResponse(config, 200, {
      success: true,
      data: { user },
      message: 'Session restored (mock backend).',
    });
  }

  if (method === 'post' && url.endsWith('/auth/logout')) {
    setAccessToken(null);
    writeMockUser(null);
    return buildMockResponse(config, 200, {
      success: true,
      data: null,
      message: 'Signed out (mock backend).',
    });
  }

  if (method === 'post' && url.includes('/files/registration')) {
    const id = 'file-mock-' + Math.random().toString(36).slice(2, 10);
    const claimToken = 'claim-' + Math.random().toString(36).slice(2, 14);
    let name = 'upload.pdf';
    let mimeType = 'application/pdf';
    let sizeBytes = 128_000;
    if (config.data instanceof FormData) {
      try {
        const f = config.data.get('file') as unknown as File | null;
        if (f) {
          name = f.name || name;
          mimeType = f.type || mimeType;
          sizeBytes = typeof f.size === 'number' ? f.size : sizeBytes;
        }
      } catch {
        /* ignore */
      }
    }
    return buildMockResponse(config, 200, {
      success: true,
      data: { id, claimToken, name, mimeType, sizeBytes, uploadedAt: new Date().toISOString() },
      message: 'Document uploaded (mock backend — nothing persisted).',
    });
  }

  if (method === 'delete' && url.includes('/files/registration/')) {
    return buildMockResponse(config, 200, {
      success: true,
      data: null,
      message: 'Document removed (mock backend).',
    });
  }

  if (method === 'post' && url.endsWith('/contact')) {
    return buildMockResponse(config, 200, {
      success: true,
      data: { receivedAt: new Date().toISOString(), ticketId: 'TKT-' + Math.floor(Math.random() * 90000 + 10000) },
      message: 'Message received — expect a reply within 24-48 hours (mock backend).',
    });
  }

  return null;
}

export const apiClient = axios.create({
  baseURL,
  // Required so the refresh-token cookie is sent (auth lands in Milestone 5).
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem('ifsmhp.accessToken', token);
  else localStorage.removeItem('ifsmhp.accessToken');
}

/**
 * Lets callers ask whether a session is even plausible before probing the API.
 * Keeps the storage key owned by this module.
 */
export function getAccessToken() {
  return accessToken;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const refreshUrl = '/auth/refresh';
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        const refreshed = await apiClient.post<{ success: true; data: { accessToken: string } }>(refreshUrl);
        setAccessToken(refreshed.data.data.accessToken);
        original.headers = AxiosHeaders.from(original.headers ?? {});
        original.headers.set('Authorization', `Bearer ${refreshed.data.data.accessToken}`);
        return apiClient(original);
      } catch {
        setAccessToken(null);
      }
    }

    const mockResp = original?.url?.startsWith('/admin/audit-log') ? null : tryMockFallback(error);
    if (mockResp) return mockResp;

    throw error;
  },
);

/**
 * Converts any Axios failure into a predictable shape so components never
 * have to reach into `error.response.data` and guess.
 *
 * The access-token attachment and the 401 → refresh → retry interceptor are
 * added in Milestone 5, once the auth endpoints exist.
 */
export function normalizeError(error: unknown): NormalizedApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiFailure>;
    const data = axiosError.response?.data;

    const fieldErrors: Record<string, string> = {};
    for (const item of data?.errors ?? []) {
      fieldErrors[item.field] = item.message;
    }

    return {
      status: axiosError.response?.status ?? null,
      message:
        data?.message ??
        (axiosError.code === 'ECONNABORTED'
          ? 'The request timed out. Try again.'
          : 'Could not reach the server. Check your connection and try again.'),
      fieldErrors,
      ...(data?.meta ? { meta: data.meta } : {}),
      ...(typeof data?.meta?.reason === 'string' ? { reason: data.meta.reason } : {}),
      ...(data?.requestId ? { requestId: data.requestId } : {}),
    };
  }

  return {
    status: null,
    message: 'An unexpected error occurred.',
    fieldErrors: {},
  };
}
