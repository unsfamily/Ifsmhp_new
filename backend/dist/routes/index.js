"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_routes_1 = __importDefault(require("./health.routes"));
/**
 * API v1 router (spec §39).
 *
 * Modules are mounted here as milestones land. The commented block is the
 * agreed module map from the architecture document — kept visible so the
 * remaining surface area is obvious, but NOT stubbed out with fake handlers
 * (spec §67 — never fabricate functionality).
 *
 *   /auth              Milestone 5
 *   /membership        Milestone 6
 *   /members           Milestone 8
 *   /projects          Milestone 9
 *   /support-requests  Milestone 10
 *   /messages          Milestone 11
 *   /publications      Milestone 12
 *   /files             Milestone 9
 *   /notifications     Milestone 15
 *   /events            Milestone 14
 *   /contact           Milestone 7
 *   /public            Milestone 7
 *   /admin             Milestone 13
 */
const router = (0, express_1.Router)();
router.use('/health', health_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map