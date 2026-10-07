/**
 * src/api/core.ts
 * ================
 * Centralised HTTP client for the EcoSort AI backend.
 *
 * - Environment-based base URL via VITE_API_BASE_URL
 * - Automatic Bearer token injection from localStorage
 * - Typed error classes (NetworkError, TimeoutError, ApiError)
 * - Automatic retry on transient failures (5xx, network, timeout) with
 *   exponential back-off (max 3 attempts)
 * - User-friendly error messages — never exposes raw "backend not running"
 */

// ── Base URL resolution ───────────────────────────────────────────────────────
//
// Local dev:  VITE_API_BASE_URL is NOT set → proxy to /api/v1
// Production: VITE_API_BASE_URL=https://your-backend.railway.app
//             → absolute URL https://your-backend.railway.app/api/v1
//
const _rawBase = import.meta.env.VITE_API_BASE_URL as string | undefined
export const API_BASE = _rawBase ? `${_rawBase}/api/v1` : '/api/v1'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_TIMEOUT_MS = 15_000     // 15 s
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 800
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

// ── Token storage ─────────────────────────────────────────────────────────────
const TOKEN_KEY = 'ecosort_access_token'
const REFRESH_KEY = 'ecosort_refresh_token'

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string): void => {
    localStorage.setItem(TOKEN_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ── Error classes ─────────────────────────────────────────────────────────────

export class NetworkError extends Error {
  readonly kind = 'network' as const
  constructor() {
    super('Unable to reach the server. Please check your internet connection.')
    this.name = 'NetworkError'
  }
}

export class TimeoutError extends Error {
  readonly kind = 'timeout' as const
  constructor() {
    super('The request timed out. The server may be busy — please try again.')
    this.name = 'TimeoutError'
  }
}

export class ApiError extends Error {
  readonly kind = 'api' as const
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── User-friendly HTTP status → message ───────────────────────────────────────

function friendlyMessage(status: number, serverDetail?: string): string {
  if (serverDetail && typeof serverDetail === 'string') return serverDetail
  switch (status) {
    case 400: return 'The request was invalid. Please check your input.'
    case 401: return 'Your session has expired. Please log in again.'
    case 403: return 'You do not have permission to perform this action.'
    case 404: return 'The requested resource was not found.'
    case 409: return 'A conflict occurred — this resource may already exist.'
    case 413: return 'The file is too large to upload.'
    case 415: return 'Unsupported file type. Please use PNG, JPG, or WebP.'
    case 422: return 'Validation failed. Please check your input and try again.'
    case 429: return 'Too many requests. Please slow down and try again in a moment.'
    case 500: return 'An unexpected server error occurred. Please try again.'
    case 503: return 'The service is temporarily unavailable. Please try again shortly.'
    default:
      return status >= 500
        ? 'A server error occurred. Please try again.'
        : 'Something went wrong. Please try again.'
  }
}

// ── Internal fetch with timeout ───────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError()
    }
    throw new NetworkError()
  } finally {
    clearTimeout(timer)
  }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  attempt = 0,
): Promise<Response> {
  try {
    const res = await fetchWithTimeout(url, options, timeoutMs)
    if (!res.ok && RETRYABLE_STATUS.has(res.status) && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      return fetchWithRetry(url, options, timeoutMs, attempt + 1)
    }
    return res
  } catch (err) {
    if ((err instanceof NetworkError || err instanceof TimeoutError) && attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)))
      return fetchWithRetry(url, options, timeoutMs, attempt + 1)
    }
    throw err
  }
}

// ── Core request function ─────────────────────────────────────────────────────

export interface RequestOptions {
  /** Override timeout in milliseconds (default 15 000) */
  timeout?: number
  /** Skip injecting the Authorization header */
  skipAuth?: boolean
  /** Extra headers */
  headers?: Record<string, string>
}

export async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const headers: Record<string, string> = { ...opts.headers }

  if (!opts.skipAuth) {
    const token = tokenStore.getAccess()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const init: RequestInit = {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  }

  const res = await fetchWithRetry(url, init, opts.timeout ?? DEFAULT_TIMEOUT_MS)

  if (res.ok) {
    // 204 No Content
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  // Parse error body
  let detail: unknown
  try {
    const errBody = await res.json()
    detail = errBody.detail ?? errBody.message ?? errBody
  } catch {
    detail = undefined
  }

  const message = friendlyMessage(
    res.status,
    typeof detail === 'string' ? detail : undefined,
  )
  throw new ApiError(res.status, message, detail)
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, body, opts),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>('DELETE', path, undefined, opts),
}
