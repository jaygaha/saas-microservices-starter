import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import * as auth from '../lib/auth'
import { ensureSession } from '../lib/api'

interface AuthState {
    user: User | null
    loading: boolean,
    login: (email: string, password: string) => Promise<void>
    register: (email: string, password: string, fullName: string) => Promise<void>
    logout: () => Promise<void>
}

const AuthCtx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const booted = useRef(false)

    // On load: get an access token (via refresh) if we have a session, then load
    // the user once. The ref guard neutralizes StrictMode's double-invoke in dev.
    useEffect(() => {
        if (booted.current) return
        booted.current = true
            ; (async () => {
                try {
                    if (await ensureSession()) setUser(await auth.me())
                } catch {
                    setUser(null)
                } finally {
                    setLoading(false)
                }
            })()
    }, [])

    const value: AuthState = {
        user,
        loading,
        login: async (email, password) => setUser(await auth.login(email, password)),
        register: async (email, password, fullName) => setUser(await auth.register(email, password, fullName)),
        logout: async () => { await auth.logout(); setUser(null) }
    }

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthCtx)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')

    return ctx
}
