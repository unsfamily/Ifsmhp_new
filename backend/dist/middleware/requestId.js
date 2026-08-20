"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestId = requestId;
const node_crypto_1 = require("node:crypto");
/**
 * Assigns a correlation ID to every request. Returned to the client on
 * failures so a user can quote it in a support message without the server
 * having to expose any internal detail.
 */
function requestId(_req, res, next) {
    const id = (0, node_crypto_1.randomUUID)();
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}
//# sourceMappingURL=requestId.js.map