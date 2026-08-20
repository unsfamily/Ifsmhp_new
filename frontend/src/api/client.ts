import axios, { AxiosError } from 'axios';

/** Failure envelope returned by the API (spec §40). */
export interface ApiFailure {
  success: false;
  message: string;
  errors: { field: string; message: string }[];
  requestId?: string;
}

/** Normalized error the UI can rely on regardless of what went wrong. */
export interface NormalizedApiError {
  status: number | null;
  message: string;
  fieldErrors: Record<string, string>;
  requestId?: string;
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL,
  // Required so the refresh-token cookie is sent (auth lands in Milestone 5).
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

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
      ...(data?.requestId ? { requestId: data.requestId } : {}),
    };
  }

  return {
    status: null,
    message: 'An unexpected error occurred.',
    fieldErrors: {},
  };
}
