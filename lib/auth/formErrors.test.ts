import { describe, expect, it } from 'vitest'
import {
  AuthFormError,
  authBannerMessage,
  authErrorParam,
  readAuthErrors,
} from '@/lib/auth/formErrors'

describe('auth form errors', () => {
  it('round-trips every reason through the redirect query', () => {
    const param = authErrorParam(new AuthFormError('email', 'password_mismatch'))
    expect(param).toBe('email,password_mismatch')
    const errors = readAuthErrors(param)
    expect(errors.form).toEqual([])
    expect(errors.fields.email).toMatch(/valid email/)
    expect(errors.fields.confirmPassword).toMatch(/do not match/)
    expect(authBannerMessage(errors)).toBe('Fix the 2 fields marked below, then try again.')
  })

  it('keeps unexpected failures generic', () => {
    expect(authErrorParam(new Error('connection refused at 10.0.0.1'))).toBe('unknown')
    expect(readAuthErrors('<script>').form).toEqual([
      'Something went wrong on our side. Try again in a moment.',
    ])
    expect(readAuthErrors('1').form).toHaveLength(1)
  })

  it('puts form-level reasons in the banner', () => {
    const errors = readAuthErrors('rate')
    expect(errors.fields).toEqual({})
    expect(authBannerMessage(errors)).toMatch(/Too many attempts/)
    expect(authBannerMessage(readAuthErrors(undefined))).toBeNull()
  })

  it('reads as a person-facing message where Error text is shown', () => {
    const err = new AuthFormError('email')
    expect('code' in err).toBe(false)
    expect(err.message).toMatch(/valid email/)
  })
})
