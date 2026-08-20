"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendFailure = sendFailure;
function sendSuccess(res, data, message = 'Operation completed successfully', statusCode = 200) {
    return res.status(statusCode).json({ success: true, data, message });
}
function sendFailure(res, statusCode, message, errors = []) {
    const body = { success: false, message, errors };
    if (res.locals.requestId)
        body.requestId = res.locals.requestId;
    return res.status(statusCode).json(body);
}
//# sourceMappingURL=apiResponse.js.map