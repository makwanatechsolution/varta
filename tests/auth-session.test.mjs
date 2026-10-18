import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/authSession.ts', import.meta.url), 'utf8').replace(/export /g, '');
const context = vm.createContext({ Error });
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function harness(loader) {
  let user = { uid: 'google-user' };
  const states = [];
  let loads = 0;
  const session = context.createAuthSession({ currentUser: () => user, loadProfile: () => { loads++; return loader(); }, publish: state => states.push(state) });
  return { session, states, setUser: value => { user = value; }, get user() { return user; }, get loads() { return loads; } };
}

test('popup result and auth callback share one profile request', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  const popup = h.session.restore(h.user);
  const callback = h.session.restore(h.user);
  assert.equal(h.loads, 1);
  pending.resolve({ id: h.user.uid });
  await Promise.all([popup, callback]);
  assert.equal(h.states.at(-1).profile.id, 'google-user');
  assert.equal(h.states.at(-1).loading, false);
});

test('late initial signed-out event cannot undo Google login', async () => {
  const h = harness(async () => ({ id: 'google-user' }));
  await h.session.restore(h.user);
  await h.session.restore(null);
  assert.equal(h.states.at(-1).user.uid, 'google-user');
});

test('repeated auth events preserve the confirmed profile; explicit retry reloads', async () => {
  const h = harness(async () => ({ id: 'google-user' }));
  await h.session.restore(h.user);
  await h.session.restore(h.user);
  assert.equal(h.loads, 1);
  await h.session.restore(h.user, true);
  assert.equal(h.loads, 2);
});

test('API failure preserves Google identity and exposes a retryable error', async () => {
  let failing = true;
  const h = harness(async () => { if (failing) throw new Error('Invalid token'); return { id: 'google-user' }; });
  await h.session.restore(h.user);
  assert.equal(h.states.at(-1).user.uid, 'google-user');
  assert.equal(h.states.at(-1).error, 'Invalid token');
  assert.equal(h.states.at(-1).loading, false);
  failing = false;
  await h.session.restore(h.user, true);
  assert.equal(h.states.at(-1).error, null);
  assert.equal(h.states.at(-1).profile.id, 'google-user');
});

test('signing out during profile loading never restores the previous account', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  const loading = h.session.restore(h.user);
  h.setUser(null);
  await h.session.restore(null);
  pending.resolve({ id: 'google-user' });
  await loading;
  assert.equal(h.states.at(-1).user, null);
  assert.equal(h.states.at(-1).profile, null);
});

test('switching accounts rejects a stale profile response', async () => {
  const first = deferred();
  let count = 0;
  const h = harness(() => ++count === 1 ? first.promise : Promise.resolve({ id: 'second-user' }));
  const oldRequest = h.session.restore(h.user);
  h.setUser({ uid: 'second-user' });
  await h.session.restore(h.user);
  first.resolve({ id: 'google-user' });
  await oldRequest;
  assert.equal(h.states.at(-1).profile.id, 'second-user');
});

test('disposed mount cannot publish a late response in StrictMode', async () => {
  const pending = deferred();
  const h = harness(() => pending.promise);
  const loading = h.session.restore(h.user);
  h.session.dispose();
  const before = h.states.length;
  pending.resolve({ id: 'google-user' });
  await loading;
  assert.equal(h.states.length, before);
});
