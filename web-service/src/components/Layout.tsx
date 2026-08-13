import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from './ui'

export function Layout({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth()
    const navigate = useNavigate()

    async function handleLogout() {
        await logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className="min-h-full">
            <header className="border-b border-line bg-surface">
                <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
                    <Link to="/teams" className="text-sm font-semibold text-ink">Task Manager</Link>
                    <div className="flex items-center gap-3 text-sm text-muted">
                        <span>{user?.email}</span>
                        <Button variant="ghost" onClick={handleLogout}>Log out</Button>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        </div>
    )
}