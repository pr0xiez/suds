import { describe, expect, it } from 'vitest'
import { launchReadiness } from './readiness'

describe('launch readiness', () => {
  it('does not treat local files or missing delivery credentials as production ready', () => {
    const checks = launchReadiness({
      DATABASE_URL: 'postgresql://test',
      DIRECT_URL: 'postgresql://test',
      STORAGE_DRIVER: 'local',
      PUBLIC_APP_URL: 'http://localhost:3000',
    })
    expect(checks.find((check) => check.name === 'Private durable media storage')?.ready).toBe(
      false,
    )
    expect(checks.find((check) => check.name === 'Public HTTPS application origin')?.ready).toBe(
      false,
    )
    expect(checks.find((check) => check.name === 'Transactional email connection')?.ready).toBe(
      false,
    )
  })
  it('rejects credential-bearing and path-bearing application origins', () => {
    for (const origin of [
      'https://user:pass@suds.example',
      'https://suds.example/reset',
      'https://suds.example?token=secret',
    ]) {
      expect(
        launchReadiness({ PUBLIC_APP_URL: origin }).find(
          (check) => check.name === 'Public HTTPS application origin',
        )?.ready,
      ).toBe(false)
    }
  })
})
