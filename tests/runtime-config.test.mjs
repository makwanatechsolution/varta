import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../server/src/runtime-config.ts', import.meta.url), 'utf8').replace(/export /g, '');
const context = vm.createContext({ URL });
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context);
const { databaseUrlOptions, appOrigin, pushCredentialsError } = context;
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { Client } = require('pg');

test('legacy require mode preserves certificate verification without ambiguous SSL aliases', () => {
  const options = databaseUrlOptions('postgres://user:pass@db.example/app?sslmode=require');
  assert.equal(new URL(options.connectionString).searchParams.get('sslmode'), 'verify-full');
  const client = new Client(options);
  assert.notEqual(client.connectionParameters.ssl, false);
  assert.notEqual(client.connectionParameters.ssl.rejectUnauthorized, false);
});

test('explicit libpq require compatibility remains unchanged', () => {
  const options = databaseUrlOptions('postgres://user:pass@db.example/app?sslmode=require&uselibpqcompat=true');
  assert.equal(new URL(options.connectionString).searchParams.get('sslmode'), 'require');
  assert.equal(new Client(options).connectionParameters.ssl.rejectUnauthorized, false);
});

test('explicit SSL disable wins over URL modes without contradictory config', () => {
  const options = databaseUrlOptions('postgres://user:pass@db.example/app?sslmode=require', true);
  assert.equal(new Client(options).connectionParameters.ssl, false);
});

test('URL without SSL options verifies server certificates by default', () => {
  assert.equal(databaseUrlOptions('postgres://user:pass@db.example/app').ssl.rejectUnauthorized, true);
});

test('wildcard app URLs are ignored and valid frontend origin is selected', () => {
  assert.equal(appOrigin('*', 'https://chat.example/path'), 'https://chat.example');
  assert.equal(appOrigin('*'), 'https://chat.makwanatechsolution.in');
  assert.equal(appOrigin('https://*.example'), 'https://chat.makwanatechsolution.in');
});

test('Render missing Google credentials produces an actionable configuration error', () => {
  assert.match(pushCredentialsError({ RENDER: 'true' }), /FIREBASE_SERVICE_ACCOUNT_KEY/);
  assert.equal(pushCredentialsError({ RENDER: 'true', FIREBASE_SERVICE_ACCOUNT_KEY: '{}' }), null);
  assert.equal(pushCredentialsError({ RENDER: 'true', GOOGLE_APPLICATION_CREDENTIALS: '/etc/secrets/firebase.json' }), null);
  assert.equal(pushCredentialsError({}), null);
});
