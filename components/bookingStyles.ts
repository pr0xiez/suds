import clsx from 'clsx'
import { btnPrimary, inputClass } from '@/components/ui'

/** Customer-facing aliases of the shared controls, with roomier touch targets. */
export const bookingInput = clsx(inputClass, 'min-h-11!')

export const bookingButton = clsx(btnPrimary, 'min-h-11! px-5!')
