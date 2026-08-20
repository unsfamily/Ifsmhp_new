/**
 * Application-level error carrying an HTTP status and a *safe*, user-facing
 * message. Anything thrown that is not an ApiError is treated as unexpected
 * and reported to the client as a generic 500 (spec §40 — never leak database
 * errors, SQL, stack traces, filesystem paths or secrets).
 */
export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errors: FieldError[];
  /** Marks errors that are safe to surface verbatim to the client. */
  public readonly isOperational = true;

  constructor(statusCode: number, message: string, errors: FieldError[] = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Invalid request', errors: FieldError[] = []): ApiError {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, message);
  }

  /**
   * Used both for genuinely missing records and for records the caller is not
   * allowed to see, so that member-scoped resources do not leak their
   * existence (architecture §B.3 rule R5).
   */
  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }

  static conflict(message = 'Resource already exists'): ApiError {
    return new ApiError(409, message);
  }

  static unprocessable(message = 'Validation failed', errors: FieldError[] = []): ApiError {
    return new ApiError(422, message, errors);
  }

  static tooManyRequests(message = 'Too many requests, please try again later'): ApiError {
    return new ApiError(429, message);
  }

  static internal(message = 'An unexpected error occurred'): ApiError {
    return new ApiError(500, message);
  }
}
