"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
/**
 * Validates body, query AND params against Zod schemas (spec §67 — validate
 * all external input). Parsed output replaces the raw input so downstream
 * code works with coerced, stripped, typed values rather than raw strings.
 */
function validate(schemas) {
    return (req, _res, next) => {
        try {
            if (schemas.params)
                req.params = schemas.params.parse(req.params);
            if (schemas.query) {
                // Express 5 makes req.query a getter; assign defensively.
                Object.defineProperty(req, 'query', {
                    value: schemas.query.parse(req.query),
                    writable: true,
                    configurable: true,
                });
            }
            if (schemas.body)
                req.body = schemas.body.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError)
                next(error);
            else
                next(error);
        }
    };
}
//# sourceMappingURL=validate.js.map