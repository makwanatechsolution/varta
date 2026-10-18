import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(statuses, user = { getIdToken: async force => force ? 'fresh' : 'cached' }) {
  const requests = [];
  const refreshes = [];
  if (user) {
    const original = user.getIdToken;
    user.getIdToken = async force => { refreshes.push(force); return original(force); };
  }
  let source = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  source = source.replace(/^import .*;$/gm, '').replace('import.meta.env.VITE_API_URL', 'undefined');
  source = source.replace(/export /g, '');
  source += '\nglobalThis.client = { api, messagesApi };';
  const context = vm.createContext({
    firebaseAuth: { currentUser: user, authStateReady: async () => {} },
    Headers, FormData, Blob, console, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({ url, headers: new Headers(options.headers), body: options.body });
      const status = statuses.shift() ?? 200;
      return { ok: status === 200, status, json: async () => status === 200 ? { url: 'https://api.example/uploads/photo' } : { error: 'Invalid token' } };
    },
  });
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
  return { ...context.client, requests, refreshes };
}

test('401 refreshes token and retries the original JSON mutation once', async () => {
  const { api, requests, refreshes } = harness([401, 200]);
  const result = await api.post('/api/statuses', { text_content: 'hello' });
  assert.equal(result.error, null);
  assert.deepEqual(refreshes, [false, true]);
  assert.equal(requests[0].headers.get('Authorization'), 'Bearer cached');
  assert.equal(requests[1].headers.get('Authorization'), 'Bearer fresh');
  assert.equal(requests[0].body, requests[1].body);
});

test('invalid sessions stop after one retry and expose the error', async () => {
  const { api, requests } = harness([401, 401]);
  assert.equal((await api.get('/api/conversations')).error, 'Invalid token');
  assert.equal(requests.length, 2);
});

test('signed out users do not send unauthenticated API requests', async () => {
  const { api, requests } = harness([], null);
  assert.equal((await api.get('/api/conversations')).error, 'Please sign in to continue.');
  assert.equal(requests.length, 0);
});

test('media uploads refresh authentication and retain multipart data', async () => {
  const { messagesApi, requests } = harness([401, 200]);
  assert.equal(await messagesApi.uploadMedia(new Blob(['photo']), 'photo.png'), 'https://api.example/uploads/photo');
  assert.equal(requests.length, 2);
  assert.ok(requests[0].body instanceof FormData);
  assert.equal(requests[1].headers.get('Content-Type'), null);
  assert.equal(requests[0].body, requests[1].body);
});
