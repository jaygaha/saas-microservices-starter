import { api, setSession, clearSession, getRefreshToken } from './api'
import type { AuthResponse, User } from '../types'

export async function login(email: string, password: string): Promise<User> {
    const data = await api<AuthResponse>('/auth/login', {
        method: 'POST', body: { email, password }, auth: false,
    })

    setSession(data)

    return data.user
}

export async function register(email: string, password: string, full_name: string): Promise<User> {
    const data = await api<AuthResponse>('/auth/register', {
        method: 'POST', body: { email, password, full_name }, auth: false,
    })
    setSession(data)

    return data.user
}

export async function me(): Promise<User> {
    return api<User>('/auth/me')
}

export async function logout(): Promise<void> {
    const rt = getRefreshToken()
    try {
        if (rt) await api('/auth/logout', { method: 'POST', body: { refresh_token: rt }, auth: false })
    } finally {
        clearSession()
    }
}
