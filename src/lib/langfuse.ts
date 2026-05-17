import 'server-only'

import { Langfuse } from 'langfuse'

let cached: Langfuse | null | undefined

/**
 * Server-only singleton Langfuse client.
 * Returns null if env vars are not configured — instrumentation calls become no-ops.
 *
 * Env vars (host accepts any of these, in order):
 *   LANGFUSE_BASE_URL / LANGFUSE_BASEURL / LANGFUSE_HOST  — e.g. http://localhost:3001
 *   LANGFUSE_PUBLIC_KEY    — pk-lf-...
 *   LANGFUSE_SECRET_KEY    — sk-lf-...
 */
export function getLangfuse(): Langfuse | null {
  if (cached !== undefined) return cached

  const host = process.env.LANGFUSE_BASE_URL
    ?? process.env.LANGFUSE_BASEURL
    ?? process.env.LANGFUSE_HOST
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!host || !publicKey || !secretKey) {
    cached = null
    return null
  }

  cached = new Langfuse({
    baseUrl: host,
    publicKey,
    secretKey,
    flushAt: 1,
    flushInterval: 1000,
  })
  return cached
}

/**
 * Flush pending events. Call before process exits in short-lived routes (Vercel serverless)
 * so traces don't disappear when the request ends.
 */
export async function flushLangfuse(): Promise<void> {
  if (cached) await cached.flushAsync()
}
