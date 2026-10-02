// Static image imports (`import hero from '@/public/...jpg'`) need Next's image
// module types. next-env.d.ts provides them but is gitignored and only exists
// after `next dev` or `next build`, so a clean `npm run typecheck` needs this.
/// <reference types="next/image-types/global" />
