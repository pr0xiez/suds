import type { Platform } from '@/lib/generated/prisma/enums'

interface SocialSettings {
  instagramHandle: string
  facebookPage: string
  tiktokHandle: string
}

/** Where "open the app and post it" should land, per platform. */
export function platformOpenUrl(platform: Platform, settings: SocialSettings): string {
  switch (platform) {
    case 'INSTAGRAM':
      return settings.instagramHandle
        ? `https://www.instagram.com/${settings.instagramHandle}`
        : 'https://www.instagram.com'
    case 'FACEBOOK':
      if (!settings.facebookPage) return 'https://www.facebook.com'
      return settings.facebookPage.startsWith('http')
        ? settings.facebookPage
        : `https://www.facebook.com/${settings.facebookPage}`
    case 'TIKTOK':
      return settings.tiktokHandle
        ? `https://www.tiktok.com/@${settings.tiktokHandle}`
        : 'https://www.tiktok.com'
    case 'GOOGLE_BUSINESS':
      return 'https://business.google.com'
  }
}
