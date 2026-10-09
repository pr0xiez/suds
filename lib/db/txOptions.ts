// Shared interactive-transaction limits; Neon cold starts and serialized schedule locks need headroom.
export const TX_OPTS = { timeout: 20_000, maxWait: 20_000 } as const
