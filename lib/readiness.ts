export interface ReadinessCheck {
  name: string
  ready: boolean
}
export function launchReadiness(
  env: Record<string, string | undefined> = process.env,
): ReadinessCheck[] {
  const value = (name: string) => Boolean(env[name]?.trim())
  const httpsOrigin = (name: string) => {
    try {
      const url = new URL(env[name] ?? '')
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        url.pathname === '/'
      )
    } catch {
      return false
    }
  }
  return [
    {
      name: 'Database runtime and migration connections',
      ready: value('DATABASE_URL') && value('DIRECT_URL'),
    },
    { name: 'Public HTTPS application origin', ready: httpsOrigin('PUBLIC_APP_URL') },
    {
      name: 'Private durable media storage',
      ready:
        env.STORAGE_DRIVER === 's3' &&
        value('S3_BUCKET') &&
        value('S3_REGION') &&
        value('S3_ACCESS_KEY_ID') &&
        value('S3_SECRET_ACCESS_KEY') &&
        httpsOrigin('S3_ENDPOINT'),
    },
    {
      name: 'Transactional email connection',
      ready:
        value('EMAIL_PROVIDER_TOKEN') &&
        value('EMAIL_FROM') &&
        (() => {
          try {
            return new URL(env.EMAIL_PROVIDER_URL ?? '').protocol === 'https:'
          } catch {
            return false
          }
        })(),
    },
    { name: 'Authenticated background worker', ready: (env.CRON_SECRET?.length ?? 0) >= 32 },
    {
      name: 'Hosted marketing assistant',
      ready: value('OPENAI_API_KEY') && value('MARKETING_MODEL'),
    },
    { name: 'Uploaded video AI editing', ready: value('SUBMAGIC_API_KEY') },
    {
      name: 'Photo short rendering',
      ready: value('SHOTSTACK_API_KEY') && env.STORAGE_DRIVER === 's3',
    },
  ]
}
