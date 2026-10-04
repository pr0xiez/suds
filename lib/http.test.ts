import type { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clientIp, declaredBodyWithin, sameOriginOk } from '@/lib/http'

const request = (headers: Record<string, string>) =>
  new Request('https://suds.example.test/api/login', { method: 'POST', headers }) as NextRequest

afterEach(() => vi.unstubAllEnvs())

describe('sameOriginOk', () => {
  it('requires a present Origin to match the host', () => {
    expect(
      sameOriginOk(request({ origin: 'https://suds.example.test', host: 'suds.example.test' })),
    ).toBe(true)
    expect(
      sameOriginOk(request({ origin: 'https://evil.example', host: 'suds.example.test' })),
    ).toBe(false)
    expect(sameOriginOk(request({ origin: 'null', host: 'suds.example.test' }))).toBe(false)
  })

  it('falls back to the browser fetch metadata when Origin is absent', () => {
    expect(sameOriginOk(request({}))).toBe(true)
    expect(sameOriginOk(request({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(sameOriginOk(request({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
  })
})

describe('clientIp', () => {
  it('ignores entries a client can prepend to X-Forwarded-For', () => {
    expect(clientIp(request({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientIp(request({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9' }))).toBe(
      '203.0.113.9',
    )
    expect(clientIp(request({}))).toBe('local')
  })

  it('skips the configured number of trusted proxies', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')
    expect(clientIp(request({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9, 10.0.0.2' }))).toBe(
      '203.0.113.9',
    )
    expect(clientIp(request({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9')
  })
})

describe('declaredBodyWithin', () => {
  it('refuses oversized and undeclared bodies', () => {
    expect(declaredBodyWithin(request({ 'content-length': '100' }), 16_384)).toBe(true)
    expect(declaredBodyWithin(request({ 'content-length': '16385' }), 16_384)).toBe(false)
    expect(declaredBodyWithin(request({}), 16_384)).toBe(false)
    expect(declaredBodyWithin(request({ 'content-length': 'abc' }), 16_384)).toBe(false)
  })
})
