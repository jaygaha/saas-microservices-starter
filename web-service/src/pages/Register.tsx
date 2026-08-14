import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiError } from '../lib/api'
import { Button, Card, Input } from '../components/ui'

export function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        setBusy(true)
        setError(null)

        try {
            await register(email, password, fullName)
            navigate('/teams', { replace: true })
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="grid min-h-full place-items-center px-4">
            <Card className="w-full max-w-sm">
                <h1 className="text-lg font-semibold text-ink">Create account</h1>
                <form onSubmit={onSubmit} className="mt-4 space-y-3">
                    <Input label="Full name" value={fullName}
                        onChange={(e) => setFullName(e.target.value)} autoFocus />
                    <Input label="Email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} required />
                    <Input label="Password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={busy} className="w-full">
                        {busy ? 'Creating…' : 'Create account'}
                    </Button>
                </form>
                <p className="mt-4 text-sm text-muted">
                    Have an account? <Link to="/login" className="text-brand hover:underline">Sign in</Link>
                </p>
            </Card>
        </div>
    )
}