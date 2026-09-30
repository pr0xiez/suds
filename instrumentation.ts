import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  console.error(
    JSON.stringify({
      time: new Date().toISOString(),
      event: 'request_error',
      name: error instanceof Error ? error.name : 'UnknownError',
      digest:
        typeof error === 'object' && error !== null && 'digest' in error
          ? String(error.digest)
          : undefined,
      method: request.method,
      route: context.routePath,
      type: context.routeType,
    }),
  )
}
