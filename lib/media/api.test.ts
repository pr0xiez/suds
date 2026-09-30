import { expect, it } from 'vitest'
import { readMediaJson } from './api'

it('bounds chunked JSON without trusting a content-length header', async () => {
  const req = new Request('https://suds.example/api/media/uploads', {
    method: 'POST',
    body: JSON.stringify({ brief: 'x'.repeat(20000) }),
  })
  expect(req.headers.get('content-length')).toBeNull()
  await expect(readMediaJson(req)).rejects.toThrow('too large')
  const small = new Request('https://suds.example/api/media/uploads', {
    method: 'POST',
    body: '{"kind":"PHOTO"}',
  })
  expect(await readMediaJson(small)).toEqual({ kind: 'PHOTO' })
})
