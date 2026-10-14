import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalRequest } from '../src/lib/local-request.ts';

function request(host, origin) {
  const headers = new Map();
  if (host !== undefined) headers.set('host', host);
  if (origin !== undefined) headers.set('origin', origin);
  return { headers: { get: (name) => headers.get(name) ?? null } };
}

test('accepts loopback requests', () => {
  assert.equal(isLocalRequest(request('localhost:3001')), true);
  assert.equal(isLocalRequest(request('127.0.0.1:3001')), true);
  assert.equal(isLocalRequest(request('localhost:3001', 'http://localhost:3001')), true);
});

test('rejects non-loopback Host headers', () => {
  assert.equal(isLocalRequest(request('192.168.1.20:3001')), false);
  assert.equal(isLocalRequest(request('localhost.evil.example')), false);
});

test('rejects mismatched or non-loopback Origins', () => {
  assert.equal(isLocalRequest(request('localhost:3001', 'http://127.0.0.1:3001')), false);
  assert.equal(isLocalRequest(request('localhost:3001', 'http://evil.example')), false);
  assert.equal(isLocalRequest(request('localhost:3001', 'http://localhost:3001/evil')), false);
  assert.equal(isLocalRequest(request('localhost:3001', 'http://localhost:3001?x=1')), false);
  assert.equal(isLocalRequest(request('localhost:3001', 'http://user@localhost:3001')), false);
});

test('rejects malformed or missing Host headers', () => {
  assert.equal(isLocalRequest(request(undefined)), false);
  assert.equal(isLocalRequest(request('http://localhost:3001/path')), false);
  assert.equal(isLocalRequest(request('localhost:3001/path')), false);
  assert.equal(isLocalRequest(request('localhost:3001?x=1')), false);
  assert.equal(isLocalRequest(request('user@localhost:3001')), false);
});
