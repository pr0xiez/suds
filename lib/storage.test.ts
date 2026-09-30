import { afterEach, expect, it, vi } from 'vitest'
import { acceptedMediaKey, directUploadUrl, isSafeObjectKey, signS3ObjectUrl } from './storage'

afterEach(() => vi.unstubAllEnvs())
it('matches the published AWS SigV4 presign fixture', () => {
  // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
  const url = signS3ObjectUrl(
    {
      endpoint: 'https://examplebucket.s3.amazonaws.com',
      bucket: 'examplebucket',
      region: 'us-east-1',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    },
    new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
    'GET',
    86400,
    {},
    new Date('2013-05-24T00:00:00Z'),
  )
  expect(new URL(url).searchParams.get('X-Amz-Signature')).toBe(
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  )
})
it('signs upload byte size and type, allows scoped legacy business IDs, rejects traversal', () => {
  for (const [key, value] of Object.entries({
    S3_ENDPOINT: 'https://example.com',
    S3_BUCKET: 'suds-test',
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'secret',
  }))
    vi.stubEnv(key, value)
  const signed = directUploadUrl('business/suds-legacy/pending/abc.mp4', 'video/mp4', 1024)
  expect(new URL(signed.url).searchParams.get('X-Amz-SignedHeaders')).toBe(
    'content-length;content-type;host',
  )
  expect(signed.headers).toEqual({ 'Content-Type': 'video/mp4' })
  expect(isSafeObjectKey('business/suds-legacy/media/abc.jpg')).toBe(true)
  expect(acceptedMediaKey('pending/business/suds-legacy/abc.jpg')).toBe(
    'business/suds-legacy/media/abc.jpg',
  )
  expect(isSafeObjectKey('business/other/../media/abc.jpg')).toBe(false)
  expect(isSafeObjectKey('https://attacker.example/file.jpg')).toBe(false)
})
