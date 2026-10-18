import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function workerHarness() {
  const handlers = {};
  const shown = [];
  const navigated = [];
  let config;
  let background;
  const client = { url: 'https://varta.test/', navigate: async url => navigated.push(url), focus: async () => {} };
  const self = {
    location: { href: 'https://varta.test/firebase-messaging-sw.js?apiKey=key&projectId=custom-project&messagingSenderId=123&appId=app', origin: 'https://varta.test' },
    addEventListener: (event, handler) => { handlers[event] = handler; },
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }); } },
  };
  const context = vm.createContext({ self, clients: { matchAll: async () => [client], openWindow: async url => navigated.push(url) }, URL, importScripts() {}, firebase: { initializeApp: value => { config = value; }, messaging: () => ({ onBackgroundMessage: handler => { background = handler; } }) } });
  vm.runInContext(readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8'), context);
  return { handlers, shown, navigated, config, background };
}

test('worker uses the same Firebase project supplied by the application', () => {
  assert.equal(workerHarness().config.projectId, 'custom-project');
});

test('data messages display once while Firebase notification payloads are not duplicated', async () => {
  const { background, shown } = workerHarness();
  await background({ data: { title: 'Alice', body: 'Hello', conversationId: 'room' } });
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, 'Alice');
  assert.equal(shown[0].data.conversationId, 'room');
  await background({ notification: { title: 'Already displayed' } });
  assert.equal(shown.length, 1);
});

test('notification click reuses a tab and opens the exact conversation', async () => {
  const { handlers, navigated } = workerHarness();
  let pending;
  handlers.notificationclick({ notification: { close() {}, data: { conversationId: 'room-123' } }, stopImmediatePropagation() {}, waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(navigated, ['https://varta.test/chat/room-123']);
});

test('notification clicks cannot navigate to another origin', () => {
  const { handlers, navigated } = workerHarness();
  handlers.notificationclick({ notification: { close() {}, data: { click_action: 'https://other.test/' } } });
  assert.equal(navigated.length, 0);
});

function deliveryHarness(count, failureCode) {
  const batches = [];
  const deleted = [];
  const rows = Array.from({ length: count }, (_, index) => ({ token: `token-${index}` }));
  const db = { query: async (sql, args) => {
    if (sql.startsWith('DELETE')) { deleted.push(...args[0]); return { rows: [] }; }
    return { rows };
  } };
  const context = vm.createContext({ console, getMessaging: () => ({ sendEachForMulticast: async message => {
    batches.push(message);
    return { successCount: failureCode ? 0 : message.tokens.length, failureCount: failureCode ? message.tokens.length : 0, responses: message.tokens.map(() => failureCode ? { error: { code: failureCode } } : { success: true }) };
  } }) });
  const source = readFileSync(new URL('../server/src/push.ts', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace('export async function', 'async function');
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
  return { deliver: data => context.deliverPush(db, ['recipient'], data), batches, deleted };
}

test('server batches more than 500 devices and sends one data-only display path', async () => {
  const { deliver, batches } = deliveryHarness(501);
  const result = await deliver({ type: 'message', title: 'Alice' });
  assert.equal(result.sent, 501);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].tokens.length, 500);
  assert.equal(batches[1].tokens.length, 1);
  assert.equal(batches[0].notification, undefined);
});

test('server removes expired device tokens after delivery failures', async () => {
  const { deliver, deleted } = deliveryHarness(2, 'messaging/registration-token-not-registered');
  assert.equal((await deliver({ type: 'message' })).failed, 2);
  assert.deepEqual(deleted, ['token-0', 'token-1']);
});

test('server preserves tokens for temporary delivery errors', async () => {
  const { deliver, deleted } = deliveryHarness(1, 'messaging/server-unavailable');
  await deliver({ type: 'incoming_call' });
  assert.equal(deleted.length, 0);
});
