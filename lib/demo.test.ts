import { describe, expect, it } from 'vitest'
import { demoEnabled } from './demo'

describe('isolated demo guard', () => {
  const env = {
    NODE_ENV: 'development',
    SUDS_DEMO_MODE: '1',
    DATABASE_URL: 'postgres://fixture:fixture@localhost/db?schema=suds_demo_a123456789bc',
  }
  it('allows only an explicitly enabled disposable development schema', () => {
    expect(demoEnabled(env)).toBe(true)
    expect(demoEnabled({ ...env, NODE_ENV: 'test' })).toBe(true)
  })
  it('denies production, ordinary schemas, missing flags and malformed URLs', () => {
    for (const override of [
      { NODE_ENV: 'production' },
      { NODE_ENV: undefined },
      { SUDS_DEMO_MODE: undefined },
      { DATABASE_URL: 'postgres://fixture:fixture@localhost/db' },
      { DATABASE_URL: 'postgres://fixture:fixture@localhost/db?schema=public' },
      { DATABASE_URL: 'postgres://fixture:fixture@localhost/db?schema=suds_demo_real' },
      { DATABASE_URL: 'invalid' },
    ])
      expect(demoEnabled({ ...env, ...override })).toBe(false)
  })
})
