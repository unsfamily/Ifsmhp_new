"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = health;
const health_service_1 = require("../services/health.service");
const apiResponse_1 = require("../utils/apiResponse");
/**
 * Controllers handle HTTP only: read the request, call a service, format the
 * response. No business logic, no Prisma access (spec §1 layering).
 */
function health(_req, res) {
    (0, apiResponse_1.sendSuccess)(res, (0, health_service_1.getHealthReport)(), 'Service is healthy');
}
//# sourceMappingURL=health.controller.js.map