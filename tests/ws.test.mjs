import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(user = { getIdToken: async () => 'token' }) {
  const sockets = [];
  const timers = new Map();
  let nextTimer = 0;
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(value) { this.sent.push(JSON.parse(value)); }
    close() { this.readyState = 3; this.onclose?.(); }
    open() { this.readyState = 1; this.onopen(); }
  }
  let source = readFileSync(new URL('../src/lib/ws.ts', import.meta.url), 'utf8');
  source = source.replace(/^import .*;$/gm, '').replace('import.meta.env.VITE_API_URL', 'undefined');
  source = source.replace('export const vartaWS = new VartaWS();', 'globalThis.manager = new VartaWS();');
  source = source.slice(0, source.indexOf('// Auto-connect'));
  const context = vm.createContext({
    firebaseAuth: { currentUser: user }, WebSocket: Socket,
    console: { log() {}, warn() {} },
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return 1; }, clearInterval() {},
  });
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
  return { manager: context.manager, sockets, timers };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('concurrent connection requests create one socket and reconnect restores subscriptions', async () => {
  const { manager, sockets, timers } = harness();
  let connected = 0;
  manager.on('messages:room', 'insert', () => {});
  manager.on('connection', 'connected', () => connected++);
  manager.connect(); manager.connect();
  await flush();
  assert.equal(sockets.length, 1);
  sockets[0].open();
  assert.equal(connected, 1);
  assert.ok(sockets[0].sent.some(msg => msg.channel === 'messages:room'));
  sockets[0].close();
  assert.equal(timers.size, 1);
  const reconnect = [...timers.values()][0]; timers.clear(); reconnect();
  await flush(); sockets[1].open();
  assert.equal(connected, 2);
  assert.ok(sockets[1].sent.some(msg => msg.channel === 'messages:room'));
});

test('explicit disconnect does not schedule reconnect', async () => {
  const { manager, sockets, timers } = harness();
  manager.connect(); await flush(); sockets[0].open();
  manager.disconnect();
  assert.equal(timers.size, 0);
  assert.equal(manager.isConnected(), false);
});

test('disconnect during token lookup prevents a late socket', async () => {
  let resolveToken;
  const { manager, sockets } = harness({ getIdToken: () => new Promise(resolve => { resolveToken = resolve; }) });
  manager.connect(); manager.disconnect(); resolveToken('token'); await flush();
  assert.equal(sockets.length, 0);
});

test('signed-out pairing can connect without an authentication token', async () => {
  const { manager, sockets } = harness(null);
  manager.connect(); await flush();
  assert.equal(sockets.length, 1);
  assert.ok(!sockets[0].url.includes('?token='));
});
