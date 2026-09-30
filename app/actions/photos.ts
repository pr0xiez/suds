'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOwner, requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { fdString, safeBackPath } from '@/lib/forms'
import { deletePhoto, setPhotoKind } from '@/lib/ops/photos'

const KINDS = ['BEFORE', 'AFTER', 'OTHER'] as const

export async function deletePhotoAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deletePhoto(user.businessId, fdString(fd, 'id'))
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/library'))
}

export async function setPhotoKindAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const kind = z.enum(KINDS).parse(fdString(fd, 'kind'))
  await setPhotoKind(user.businessId, fdString(fd, 'id'), kind)
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/library'))
}

export async function setPhotoApprovalAction(fd: FormData): Promise<void> {
  const user = await requireOwner()
  await prisma.photo.update({
    where: { id: fdString(fd, 'id'), businessId: user.businessId },
    data: { approvedForMarketing: fdString(fd, 'approved') === '1' },
  })
  revalidatePath('/', 'layout')
  redirect(safeBackPath(fdString(fd, 'back'), '/library'))
}
