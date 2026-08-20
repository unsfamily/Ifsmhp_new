"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationQuerySchema = void 0;
exports.toSkipTake = toSkipTake;
exports.buildPaginatedResult = buildPaginatedResult;
const zod_1 = require("zod");
/** Shared query schema for every paginated list endpoint (spec §41). */
exports.paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
/** Translates page/limit into Prisma's skip/take. */
function toSkipTake({ page, limit }) {
    return { skip: (page - 1) * limit, take: limit };
}
function buildPaginatedResult(items, total, { page, limit }) {
    return {
        items,
        pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    };
}
//# sourceMappingURL=pagination.js.map