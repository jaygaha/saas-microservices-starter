import type { AuthResponse } from "../types";

const BASE = '/api'
const REFRESH_KEY = 'refresh_token'

// Access token lives in memory (cleared on reload); refresh token in localStorage.
let accessToken: string | null = null

export function getAccessToken() { return accessToken }
export function getRefreshToken() { return localStorage.getItem(REFRESH_KEY) }

export function setSession(auth: AuthResponse) {
    accessToken = auth.access_token
    localStorage.setItem(REFRESH_KEY, auth.refresh_token)
}

export function clearSession() {
    accessToken = null
    localStorage.removeItem(REFRESH_KEY)
}

export class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
        this.name = 'ApiError'
    }
}

// Normalize both error envelopes: auth {error}, task {detail}.
async function messageFrom(res: Response): Promise<string> {
    try {
        const data = await res.json()
        if (typeof data?.error === 'string') return data.error
        if (typeof data?.detail === 'string') return data.detail
        if (Array.isArray(data?.detail)) return data.detail.map((d: any) => d.msg).join(', ')
    } catch { /* no/invalid body */ }

    return res.statusText || `HTTP ${res.status}`
}

// Single-flight refresh: concurrent 401s share ONE refresh call.
let refreshing: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
    const rt = getRefreshToken()
    if (!rt) return false

    const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
    })
    if (!res.ok) { clearSession(); return false }

    const data: AuthResponse = await res.json()
    setSession(data)   // backend ROTATES refresh tokens; must persist the new one

    return true
}

function refreshOnce(): Promise<boolean> {
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null })

    return refreshing
}

// Ensure a usable access token: reuse the in-memory one, else refresh once.
export async function ensureSession(): Promise<boolean> {
    if (accessToken) return true
    if (!getRefreshToken()) return false

    return refreshOnce()
}

export interface ApiOptions {
    method?: string
    body?: unknown
    auth?: boolean       // attach access token (default true)
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, auth = true } = opts

    const send = () => {
        const headers: Record<string, string> = {}
        if (body !== undefined) headers['Content-Type'] = 'application/json'
        if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`

        return fetch(`${BASE}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        })
    }

    let res = await send()

    // One refresh + retry on a 401 for an authentiated request.
    if (res.status === 401 && auth && getRefreshToken()) {
        if (await refreshOnce()) res = await send()
    }

    if (res.status === 204) return undefined as T
    if (!res.ok) throw new ApiError(res.status, await messageFrom(res))

    const text = await res.text() // logout etc. may have no body

    return text ? JSON.parse(text) : undefined as T
}
