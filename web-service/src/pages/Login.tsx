import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { ApiError } from '../lib/api'
import { Button, Card, Input } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    useDocumentTitle('Sign in')

    // defining state variables
    // [value, state_setter] = useState<type>(initial_value)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        setBusy(true)
        setError(null)

        try {
            await login(email, password)
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
                <h1 className="text-lg font-semibold text-ink">Sign in</h1>
                <form onSubmit={onSubmit} className="mt-4 space-y-3">
                    <Input label="Email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} required autoFocus />
                    <Input label="Password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)} required />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={busy} className="w-full">
                        {busy ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
                <p className="mt-4 text-sm text-muted">
                    No account? <Link to="/register" className="text-brand hover:underline">Create one</Link>
                </p>
            </Card>
        </div>
    )
}
