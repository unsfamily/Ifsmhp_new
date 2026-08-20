"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
const ApiError_1 = require("../utils/ApiError");
/** Terminal 404 for unmatched routes; hands off to the error handler. */
function notFound(req, _res, next) {
    next(ApiError_1.ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}
//# sourceMappingURL=notFound.js.map