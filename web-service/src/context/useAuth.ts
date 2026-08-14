import { createContext, useContext } from 'react'
import type { User } from '../types'

export interface AuthState {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, fullName: string) => Promise<void>
    logout: () => Promise<void>
}

// Keep this exported so the provider file can read it
export const AuthCtx = createContext<AuthState | null>(null)

export function useAuth() {
    const ctx = useContext(AuthCtx)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
