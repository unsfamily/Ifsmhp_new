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

function buildMockResponse<T>(config: AxiosRequestConfig, status: number, data: T): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
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
 * Handles auth + file endpoints when the backend is unreachable (pure network
 * failure, no HTTP response). This keeps the login flow, session restore, and
 * member/admin portals functional in frontend-only demos. Real server responses
 * always win — mock fallback is never used when a real 4xx/5xx is returned.
 */
function tryMockFallback(error: AxiosError): AxiosResponse | null {
  if (error.response) return null;
  const url = error.config?.url ?? '';
  const method = (error.config?.method ?? 'get').toLowerCase();
  const body = (error.config?.data as unknown) ?? {};
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
    (error.config?.headers as { Authorization?: string } | undefined)?.Authorization ?? undefined;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (method === 'post' && url.includes('/auth/login')) {
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
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: { accessToken: token, user },
      message: 'Signed in (mock backend).',
    });
  }

  if (method === 'post' && url.includes('/auth/otp/request')) {
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: {
        ...MOCK_OTP_RESULT,
        email: String(parsedBody.email ?? MOCK_OTP_RESULT.email),
      },
      message: 'One-time code sent (mock backend — use 123456).',
    });
  }

  if (method === 'post' && url.includes('/auth/otp/resend')) {
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: {
        ...MOCK_OTP_RESULT,
        email: String(parsedBody.email ?? MOCK_OTP_RESULT.email),
      },
      message: 'Code re-sent (mock backend — use 123456).',
    });
  }

  if (method === 'post' && url.includes('/auth/otp/verify')) {
    const code = String(parsedBody.code ?? '');
    const email = String(parsedBody.email ?? '').toLowerCase();
    if (code !== MOCK_VALID_OTP) {
      return buildMockResponse(error.config!, 400, {
        success: false,
        message: 'The code you entered is incorrect. Try 123456 in demo mode.',
        errors: [{ field: 'code', message: 'Invalid or expired code.' }],
        meta: { reason: 'incorrect' },
      });
    }
    const isAdmin = email === 'admin@ifsmhp.org' || email.includes('admin');
    const user: MockSessionUser = isAdmin
      ? { ...MOCK_ADMIN, email: email || MOCK_ADMIN.email }
      : { ...MOCK_MEMBER, email: email || MOCK_MEMBER.email };
    const token = `mock-${isAdmin ? 'admin' : 'member'}-${Math.random().toString(36).slice(2, 10)}`;
    setAccessToken(token);
    writeMockUser(user);
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: { accessToken: token, user },
      message: 'Verified and signed in (mock backend).',
    });
  }

  if (method === 'get' && url.includes('/auth/me')) {
    const user = resolveMockUserFromBearer(bearerToken);
    if (!user) return null;
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: { user },
      message: 'Session restored (mock backend).',
    });
  }

  if (method === 'post' && url.includes('/auth/logout')) {
    setAccessToken(null);
    writeMockUser(null);
    return buildMockResponse(error.config!, 200, {
      success: true,
      data: null,
      message: 'Signed out (mock backend).',
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
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/refresh')) {
      original._retry = true;
      try {
        const refreshed = await axios.post<{ success: true; data: { accessToken: string } }>(
          `${baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        setAccessToken(refreshed.data.data.accessToken);
        original.headers = AxiosHeaders.from(original.headers);
        original.headers.set('Authorization', `Bearer ${refreshed.data.data.accessToken}`);
        return apiClient(original);
      } catch {
        setAccessToken(null);
      }
    }

    const mockResp = tryMockFallback(error);
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
