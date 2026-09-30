'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { CAPTION_MAX } from '@/lib/captions'
import { parseDatetimeLocal } from '@/lib/dates'
import { fdString, fdStrings, friendlyError, safeBackPath } from '@/lib/forms'
import { getSettings } from '@/lib/ops/settings'
import {
  createPost,
  deletePost,
  markPosted,
  type PostInput,
  revertToDraft,
  schedulePost,
  updatePost,
} from '@/lib/ops/social'

export interface FormState {
  error: string
}

const PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'GOOGLE_BUSINESS'] as const
const INTENTS = ['draft', 'schedule', 'posted'] as const

/** Create/update from the PostComposer client component (useActionState). */
export async function savePostAction(_prev: FormState | null, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
  const postId = fdString(fd, 'postId')
  let savedId: string
  let intent: (typeof INTENTS)[number]
  try {
    intent = z.enum(INTENTS).parse(fdString(fd, 'intent'))
    const caption = fdString(fd, 'caption')
    if (caption.length > CAPTION_MAX) {
      return { error: `Caption is over the ${CAPTION_MAX}-character limit` }
    }
    const platforms = z.array(z.enum(PLATFORMS)).parse(fdStrings(fd, 'platforms'))

    let photoIds: string[]
    try {
      photoIds = z
        .array(z.string())
        .max(20)
        .parse(JSON.parse(fdString(fd, 'photoIds') || '[]'))
    } catch {
      return { error: 'Photo selection is malformed' }
    }

    const scheduledRaw = fdString(fd, 'scheduledFor').trim()
    const scheduledFor =
      scheduledRaw === '' ? null : parseDatetimeLocal(scheduledRaw, settings.timezone)
    if (scheduledRaw !== '' && !scheduledFor) return { error: 'Scheduled time is malformed' }

    if (intent === 'schedule' && !scheduledFor) {
      return { error: 'Pick a date and time to schedule this post' }
    }
    if (intent !== 'draft' && platforms.length === 0) {
      return { error: 'Pick at least one platform' }
    }

    const input: PostInput = {
      caption,
      platforms,
      scheduledFor,
      jobId: fdString(fd, 'jobId') || null,
      photoIds,
    }
    const post = postId
      ? await updatePost(user.businessId, postId, input)
      : await createPost(user.businessId, input)
    savedId = post.id

    if (intent === 'schedule' && scheduledFor)
      await schedulePost(user.businessId, savedId, scheduledFor)
    else if (intent === 'posted') await markPosted(user.businessId, savedId)
    else if (post.status !== 'DRAFT') await revertToDraft(user.businessId, savedId)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0]?.message ?? 'Check the form and try again' }
    }
    return { error: friendlyError(err) }
  }
  revalidatePath('/', 'layout')
  redirect(intent === 'draft' ? `/social/${savedId}?saved=1` : '/social')
}

export async function markPostedAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  await markPosted(user.businessId, id)
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/social'))
}

export async function revertToDraftAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  await revertToDraft(user.businessId, id)
  revalidatePath('/', 'layout')
  redirect(`/social/${id}`)
}

export async function deletePostAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deletePost(user.businessId, fdString(fd, 'id'))
  revalidatePath('/', 'layout')
  redirect('/social')
}
