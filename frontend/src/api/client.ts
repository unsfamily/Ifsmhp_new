import axios, { AxiosError, AxiosHeaders } from 'axios';

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
