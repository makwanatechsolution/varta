import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8');
function verifier(verifyIdToken) {
  const start = source.indexOf('async function verifyToken(');
  const end = source.indexOf('async function requireAuth(', start);
  const context = vm.createContext({ getAuth: () => ({ verifyIdToken }), console: { warn() {} }, Buffer });
  vm.runInContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 }), context);
  return context.verifyToken;
}

test('server rejects forged Firebase claims when signature verification fails', async () => {
  const verify = verifier(async () => { throw new Error('Invalid signature'); });
  const payload = { sub: 'admin-id', email: 'yash.makwana.b@gmail.com', aud: 'chatapp-varta', iss: 'https://securetoken.google.com/chatapp-varta', exp: Math.floor(Date.now() / 1000) + 3600 };
  const forged = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.forged`;
  assert.equal(await verify(forged), null);
});

test('server accepts verified Firebase identity', async () => {
  const verify = verifier(async () => ({ uid: 'user-id', email: 'User@Example.com', name: 'User' }));
  const user = await verify('valid-token');
  assert.equal(user.uid, 'user-id');
  assert.equal(user.email, 'user@example.com');
});

test('profile search resolves before dynamic profile IDs', () => {
  const routes = [];
  const app = { get: path => routes.push(path), patch() {} };
  const context = vm.createContext({ app, requireAuth() {} });
  const start = source.indexOf('app.get("/api/profiles/me"');
  const end = source.indexOf('const PUBLIC_API_URL', start);
  vm.runInContext(ts.transpile(source.slice(start, end), { target: ts.ScriptTarget.ES2022 }), context);
  assert.ok(routes.indexOf('/api/profiles/search') < routes.indexOf('/api/profiles/:id'));
});
