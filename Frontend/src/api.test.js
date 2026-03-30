import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'

import { getTokenExpiry, getTokenPayload } from './api.js'

const createTestToken = (payload) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

test('getTokenPayload decodes jwt-style payloads', () => {
  const token = createTestToken({ sub: 9, email: 'person@example.com', exp: 1700000000 })
  const payload = getTokenPayload(token)

  assert.equal(payload.sub, 9)
  assert.equal(payload.email, 'person@example.com')
  assert.equal(payload.exp, 1700000000)
})

test('getTokenExpiry returns milliseconds for scheduler use', () => {
  const token = createTestToken({ exp: 1700000000 })
  assert.equal(getTokenExpiry(token), 1700000000 * 1000)
})

test('getTokenPayload rejects malformed tokens', () => {
  assert.equal(getTokenPayload('not-a-token'), null)
})
