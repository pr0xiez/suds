import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  signVideoProject,
  uploadVideoEdit,
  validateVideoBrief,
  verifyVideoProject,
} from './videoEditing'

const id = '550e8400-e29b-41d4-a716-446655440000'
function brief() {
  const form = new FormData()
  form.set('title', 'Interior reveal')
  form.set('style', 'kelly')
  form.set('approved', 'true')
  form.set(
    'file',
    new File(
      [new Uint8Array([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])],
      'car.mp4',
    ),
  )
  return form
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe('video editing', () => {
  it('rejects a renamed non-video, missing permission, and unsupported style before uploading', async () => {
    const form = brief()
    form.set('file', new File(['not a video'], 'car.mp4', { type: 'video/mp4' }))
    await expect(validateVideoBrief(form)).rejects.toThrow('MP4 or MOV')
    form.set('approved', 'false')
    await expect(validateVideoBrief(form)).rejects.toThrow('approve')
    form.set('approved', 'true')
    form.set('style', 'arbitrary-provider-command')
    await expect(validateVideoBrief(form)).rejects.toThrow('choose a style')
  })
  it('uses only supported AI template fields and keeps the credential in the server header', async () => {
    vi.stubEnv('SUBMAGIC_API_KEY', 'fake-test-key')
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id, title: 'Interior reveal', status: 'processing' })),
      )
    vi.stubGlobal('fetch', request)
    await uploadVideoEdit(brief())
    const [url, options] = request.mock.calls[0] ?? []
    expect(url).toBe('https://api.submagic.co/v1/projects/upload')
    expect(options.headers['x-api-key']).toBe('fake-test-key')
    expect([...options.body.keys()]).toEqual(['title', 'language', 'file', 'aiEditTemplate'])
    expect(options.body.get('aiEditTemplate')).toBe('kelly')
  })
  it('rejects unsafe provider media URLs and reports uncertain uploads without exposing secrets', async () => {
    vi.stubEnv('SUBMAGIC_API_KEY', 'fake-test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id,
            title: 'Interior reveal',
            status: 'completed',
            directUrl: 'javascript:alert(1)',
          }),
        ),
      ),
    )
    await expect(uploadVideoEdit(brief())).rejects.toThrow('unexpected response')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private credential text')))
    await expect(uploadVideoEdit(brief())).rejects.toThrow('could not be confirmed')
  })
  it('binds project access to an owner, key, expiry, and untampered project identity', () => {
    const token = signVideoProject(id, 'owner-a', 'fake-key', 1000)
    expect(verifyVideoProject(token, 'owner-a', 'fake-key', 2000)).toBe(id)
    expect(verifyVideoProject(token, 'owner-b', 'fake-key', 2000)).toBeNull()
    expect(verifyVideoProject(token, 'owner-a', 'different-key', 2000)).toBeNull()
    expect(verifyVideoProject(token, 'owner-a', 'fake-key', 1000 + 30 * 86400_000)).toBeNull()
    expect(verifyVideoProject(`${token}x`, 'owner-a', 'fake-key', 2000)).toBeNull()
  })
})
