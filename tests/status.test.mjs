import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function harness(fail = false) {
  const handlers = new Map();
  const queries = [];
  const events = [];
  const app = Object.fromEntries(['get', 'post', 'delete'].map(method => [method, (path, auth, handler) => handlers.set(`${method} ${path}`, handler)]));
  const context = vm.createContext({ app, requireAuth() {}, uid: () => 'me', uuidv4: () => 'status-id', broadcast: (...args) => events.push(args), db: { query: async (sql, values) => { if (fail) throw new Error('Database offline'); queries.push({ sql, values }); return { rows: [{ id: 'status-id' }] }; } } });
  const full = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
  const source = full.slice(full.indexOf('app.get("/api/statuses"'), full.indexOf('app.get("/api/contacts"'));
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
  return { queries, events, run: async (method, path, body = {}) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    let error;
    await handlers.get(`${method} ${path}`)({ body, params: { id: 'status-id' } }, response, value => { error = value; });
    return { ...response, error };
  } };
}

test('empty status text is rejected before writing', async () => {
  const { run, queries } = harness();
  assert.equal((await run('post', '/api/statuses', { media_type: 'text', text_content: '  ' })).statusCode, 400);
  assert.equal(queries.length, 0);
});

test('status lifetime is set by server and successful posts notify subscribers', async () => {
  const { run, queries, events } = harness();
  await run('post', '/api/statuses', { media_type: 'text', text_content: 'Today', expires_at: '2099-01-01' });
  const expiry = new Date(queries[0].values[6]).getTime();
  assert.ok(Math.abs(expiry - Date.now() - 86400000) < 2000);
  assert.equal(events[0][0], 'statuses');
});

test('status media must have an uploaded HTTP URL', async () => {
  const { run } = harness();
  assert.equal((await run('post', '/api/statuses', { media_type: 'photo', media_url: 'javascript:alert(1)' })).statusCode, 400);
});

test('status database failures reach the API error handler', async () => {
  const { run } = harness(true);
  assert.equal((await run('get', '/api/statuses')).error.message, 'Database offline');
});

test('viewer lists are scoped to the status owner and exclude own views', async () => {
  const { run, queries } = harness();
  await run('get', '/api/statuses/:id/views');
  assert.equal(queries[0].values[1], 'me');
  assert.ok(queries[0].sql.includes('s.user_id = $2'));
  assert.ok(queries[0].sql.includes('sv.viewer_id != s.user_id'));
});
