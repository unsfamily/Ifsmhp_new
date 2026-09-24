// Exercise the real client module with controlled transport timing; no API or credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');
const jwt = (version = 1, session = 'session-a') => 'a.' + Buffer.from(JSON.stringify({ sub: 'admin', sessionId: session, exp: version })).toString('base64url') + '.c';
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/api/client.ts'), 'utf8').replace('import.meta.env.VITE_API_BASE_URL', "'http://test.invalid'"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function client(token = jwt()) {
  const store = new Map(token ? [['ifsmhp.accessToken', token]] : []), events = new EventTarget(), module = {}; let changes = 0;
  events.addEventListener('ifsmhp:session-changed', () => changes++);
  vm.runInNewContext(source, { exports: module, require, localStorage: { getItem: key => store.get(key) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) }, window: events, Event, Blob, atob, console, setTimeout, clearTimeout });
  return { ...module, changes: () => changes };
}
function ok(config, data = {}) { return { status: 200, data, headers: {}, config, statusText: 'OK' }; }
function fail(config, status = 401) { throw new axios.AxiosError('Test request failed', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, {}, status ? { status, data: { message: `Failure ${status}`, errors: [] }, config, headers: {} } : undefined); }
const paths = ['/admin/community/options', '/admin/community/members', '/admin/community/dashboard'];

test('concurrent expired requests share one refresh and preserve session identity', async () => {
  const c = client(), gate = deferred(); let refreshes = 0, initial = 0;
  c.apiClient.defaults.adapter = async config => {
    if (config.url === '/auth/refresh') { refreshes++; await gate.promise; return ok(config, { data: { accessToken: jwt(2) } }); }
    if (!config._retry) { if (++initial === paths.length) gate.resolve(); fail(config); }
    assert.equal(config.headers.get('Authorization'), `Bearer ${jwt(2)}`); return ok(config);
  };
  await Promise.all(paths.map(path => c.apiClient.get(path)));
  assert.equal(refreshes, 1); assert.equal(c.getAccessToken(), jwt(2)); assert.equal(c.changes(), 0);
});
test('late old-token 401 reuses already refreshed token', async () => {
  const c = client(), late = deferred(); let refreshes = 0;
  c.apiClient.defaults.adapter = async config => {
    if (config.url === '/auth/refresh') { refreshes++; return ok(config, { data: { accessToken: jwt(2) } }); }
    if (!config._retry) { if (config.url === paths[1]) await late.promise; fail(config); } return ok(config);
  };
  const held = c.apiClient.get(paths[1]); await c.apiClient.get(paths[0]); late.resolve(); await held; assert.equal(refreshes, 1);
});
for (const status of [0, 429, 500, 503]) test(`refresh failure ${status} retains session and propagates the recoverable error`, async () => {
  const c = client(); c.apiClient.defaults.adapter = async config => fail(config, config.url === '/auth/refresh' ? status : 401);
  await assert.rejects(c.apiClient.get(paths[0]), e => (e.response?.status ?? 0) === status);
  assert.equal(c.getAccessToken(), jwt()); assert.equal(c.changes(), 0);
});
for (const status of [401, 403]) test(`refresh rejection ${status} clears session once`, async () => {
  const c = client(); let refreshes = 0;
  c.apiClient.defaults.adapter = async config => { if (config.url === '/auth/refresh') { refreshes++; fail(config, status); } fail(config); };
  await Promise.allSettled(paths.map(path => c.apiClient.get(path)));
  assert.equal(refreshes, 1); assert.equal(c.getAccessToken(), null); assert.equal(c.changes(), 1);
});
test('a second 401 is not retried indefinitely', async () => {
  const c = client(); let requests = 0, refreshes = 0;
  c.apiClient.defaults.adapter = async config => { if (config.url === '/auth/refresh') { refreshes++; return ok(config, { data: { accessToken: jwt(2) } }); } requests++; fail(config); };
  await assert.rejects(c.apiClient.get(paths[0])); assert.equal(requests, 2); assert.equal(refreshes, 1); assert.equal(c.getAccessToken(), null);
});
for (const outcome of ['success', 'failure']) for (const replacement of [null, jwt(1, 'session-b')]) test(`late refresh ${outcome} cannot undo ${replacement ? 'account switch' : 'logout'}`, async () => {
  const c = client(), started = deferred(), gate = deferred();
  c.apiClient.defaults.adapter = async config => { if (config.url === '/auth/refresh') { started.resolve(); await gate.promise; if (outcome === 'failure') fail(config); return ok(config, { data: { accessToken: jwt(2) } }); } fail(config); };
  const pending = c.apiClient.get(paths[0]); const rejection = assert.rejects(pending, e => axios.isCancel(e));
  await started.promise; c.setAccessToken(replacement); gate.resolve(); await rejection; assert.equal(c.getAccessToken(), replacement);
});
for (const outcome of ['success', 'failure']) test(`old protected ${outcome} response cannot reach a new session`, async () => {
  const c = client(), started = deferred(), gate = deferred();
  c.apiClient.defaults.adapter = async config => { started.resolve(); await gate.promise; if (outcome === 'failure') fail(config); return ok(config); };
  const pending = assert.rejects(c.apiClient.get(paths[0]), e => axios.isCancel(e)); await started.promise; c.setAccessToken(jwt(1, 'session-b')); gate.resolve(); await pending; assert.equal(c.getAccessToken(), jwt(1, 'session-b'));
});
for (const path of ['/auth/login', '/auth/refresh', '/auth/me', '/auth/otp/verify', ...paths]) test(`${path} never fabricates data on network failure`, async () => {
  const c = client(); c.apiClient.defaults.adapter = async config => fail(config, 0);
  await assert.rejects(c.apiClient.get(path)); assert.equal(c.getAccessToken(), jwt());
});
test('incorrect sign-in credentials do not refresh or clear an existing session', async () => {
  const c = client(); let calls = 0; c.apiClient.defaults.adapter = async config => { calls++; fail(config); };
  await assert.rejects(c.apiClient.post('/auth/login', {})); assert.equal(calls, 1); assert.equal(c.getAccessToken(), jwt());
});
test('successful retry after temporary refresh failure', async () => {
  const c = client(); let refreshes = 0;
  c.apiClient.defaults.adapter = async config => { if (config.url === '/auth/refresh') { if (++refreshes === 1) fail(config, 503); return ok(config, { data: { accessToken: jwt(2) } }); } if (!config._retry) fail(config); return ok(config); };
  await assert.rejects(c.apiClient.get(paths[0])); await c.apiClient.get(paths[0]); assert.equal(refreshes, 2); assert.equal(c.getAccessToken(), jwt(2));
});
for (const outcome of ['success', 'failure']) test(`late refresh ${outcome} cannot replace a newer token for the same session`, async () => {
  const c = client(), started = deferred(), gate = deferred();
  c.apiClient.defaults.adapter = async config => {
    if (config.url === '/auth/refresh') { started.resolve(); await gate.promise; if (outcome === 'failure') fail(config); return ok(config, { data: { accessToken: jwt(2) } }); }
    if (!config._retry) fail(config); return ok(config);
  };
  const pending = c.apiClient.get(paths[0]); await started.promise; c.setAccessToken(jwt(3)); gate.resolve(); await pending; assert.equal(c.getAccessToken(), jwt(3)); assert.equal(c.changes(), 0);
});
