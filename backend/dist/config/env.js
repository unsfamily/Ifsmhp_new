"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
// Backend keeps its own .env; the frontend has a separate one because Vite
// inlines its variables into the public bundle and must never see secrets.
//
// The path is resolved against candidates rather than a single __dirname
// offset: __dirname is `backend/config` under tsx but `backend/dist/config`
// after compilation, so a fixed offset silently loads nothing in production
// and leaves every optional variable on its default.
const envCandidates = [
    node_path_1.default.resolve(process.cwd(), '.env'), // npm scripts run from backend/
    node_path_1.default.resolve(__dirname, '../.env'), // tsx: backend/config → backend/
    node_path_1.default.resolve(__dirname, '../../.env'), // compiled: backend/dist/config → backend/
];
const envPath = envCandidates.find((candidate) => node_fs_1.default.existsSync(candidate));
if (envPath)
    dotenv_1.default.config({ path: envPath });
/**
 * Environment schema.
 *
 * Only variables the application actually consumes are declared (spec §50).
 * Secrets are NOT given defaults — a missing secret must crash the process at
 * boot rather than silently fall back to a guessable value.
 */
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    /** Comma-separated list of allowed browser origins. */
    CLIENT_URL: zod_1.z.string().default('http://localhost:5173'),
    /** Required from Milestone 3 onward; optional while there is no schema yet. */
    DATABASE_URL: zod_1.z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    const issues = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
    // Deliberately not using the logger: config is what the logger depends on.
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
}
const raw = parsed.data;
exports.env = {
    ...raw,
    isProduction: raw.NODE_ENV === 'production',
    isTest: raw.NODE_ENV === 'test',
    /** CLIENT_URL parsed into an origin allowlist for CORS. */
    allowedOrigins: raw.CLIENT_URL.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
};
//# sourceMappingURL=env.js.map