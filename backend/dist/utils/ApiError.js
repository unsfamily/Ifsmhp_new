"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    errors;
    /** Marks errors that are safe to surface verbatim to the client. */
    isOperational = true;
    constructor(statusCode, message, errors = []) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
        this.errors = errors;
        Error.captureStackTrace(this, this.constructor);
    }
    static badRequest(message = 'Invalid request', errors = []) {
        return new ApiError(400, message, errors);
    }
    static unauthorized(message = 'Authentication required') {
        return new ApiError(401, message);
    }
    static forbidden(message = 'You do not have permission to perform this action') {
        return new ApiError(403, message);
    }
    /**
     * Used both for genuinely missing records and for records the caller is not
     * allowed to see, so that member-scoped resources do not leak their
     * existence (architecture §B.3 rule R5).
     */
    static notFound(message = 'Resource not found') {
        return new ApiError(404, message);
    }
    static conflict(message = 'Resource already exists') {
        return new ApiError(409, message);
    }
    static unprocessable(message = 'Validation failed', errors = []) {
        return new ApiError(422, message, errors);
    }
    static tooManyRequests(message = 'Too many requests, please try again later') {
        return new ApiError(429, message);
    }
    static internal(message = 'An unexpected error occurred') {
        return new ApiError(500, message);
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=ApiError.js.map