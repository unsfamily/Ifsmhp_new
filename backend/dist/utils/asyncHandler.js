"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * Wraps an async route handler so rejected promises reach the central error
 * handler instead of hanging the request. Express 4 does not do this natively.
 */
function asyncHandler(handler) {
    return (req, res, next) => {
        handler(req, res, next).catch(next);
    };
}
//# sourceMappingURL=asyncHandler.js.map