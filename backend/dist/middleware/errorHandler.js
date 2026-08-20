"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const ApiError_1 = require("../utils/ApiError");
const apiResponse_1 = require("../utils/apiResponse");
const logger_1 = require("../utils/logger");
const config_1 = require("../config");
function zodToFieldErrors(error) {
    return error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
    }));
}
/**
 * Central error handler — the ONLY place that formats an error for the client.
 *
 * Unexpected errors are logged in full server-side and reduced to a generic
 * message for the client: no stack traces, SQL, filesystem paths or secrets
 * ever cross the wire (spec §40, §43).
 */
function errorHandler(err, req, res, _next) {
    const correlation = { requestId: res.locals.requestId, method: req.method, path: req.path };
    if (err instanceof ApiError_1.ApiError) {
        if (err.statusCode >= 500)
            logger_1.logger.error(err.message, { ...correlation, stack: err.stack });
        else
            logger_1.logger.warn(err.message, correlation);
        (0, apiResponse_1.sendFailure)(res, err.statusCode, err.message, err.errors);
        return;
    }
    if (err instanceof zod_1.ZodError) {
        logger_1.logger.warn('Request validation failed', correlation);
        (0, apiResponse_1.sendFailure)(res, 422, 'Validation failed', zodToFieldErrors(err));
        return;
    }
    // Anything reaching here is a bug or an infrastructure failure.
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    logger_1.logger.error('Unhandled error', { ...correlation, message, stack });
    (0, apiResponse_1.sendFailure)(res, 500, config_1.env.isProduction ? 'An unexpected error occurred' : `Unexpected error: ${message}`);
}
//# sourceMappingURL=errorHandler.js.map