'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { fdString, safeBackPath } from '@/lib/forms'
import { deletePhoto, setPhotoKind } from '@/lib/ops/photos'

const KINDS = ['BEFORE', 'AFTER', 'OTHER'] as const

export async function deletePhotoAction(fd: FormData): Promise<void> {
  await requireUser()
  await deletePhoto(fdString(fd, 'id'))
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/library'))
}

export async function setPhotoKindAction(fd: FormData): Promise<void> {
  await requireUser()
  const kind = z.enum(KINDS).parse(fdString(fd, 'kind'))
  await setPhotoKind(fdString(fd, 'id'), kind)
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/library'))
}
