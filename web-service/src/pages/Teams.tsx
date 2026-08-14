
import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listTeams, createTeam } from '../lib/teams'
import { ApiError } from '../lib/api'
import { Button, Card, Input, Spinner } from '../components/ui'

const roleColor: Record<string, string> = {
    owner: 'bg-brand/10 text-brand',
    admin: 'bg-brand/10 text-brand',
    member: 'bg-gray-100 text-ink',
    viewer: 'bg-gray-100 text-muted',
}

export function Teams() {
    const qc = useQueryClient()
    const { data: teams, isLoading, error } = useQuery({ queryKey: ['teams'], queryFn: listTeams })
    const [name, setName] = useState('')
    const [formError, setFormError] = useState<string | null>(null)
    const create = useMutation({
        mutationFn: () => createTeam(name.trim()),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['teams'] })
            setName('')
            setFormError(null)
        },
        onError: (err) => {
            if (err instanceof ApiError) {
                setFormError(err.message)
            } else {
                setFormError('Failed to create team')
            }
        },
    })

    function onCreate(e: SubmitEvent) {
        e.preventDefault()
        if (name.trim()) create.mutate()
    }

    if (isLoading) return <Spinner />
    if (error) return <p className="text-sm text-red-600">Could not load teams.</p>

    return (
        <div>
            <h1 className="text-xl font-semibold text-ink">Your teams</h1>
            <form onSubmit={onCreate} className="mt-4 flex items-end gap-2">
                <div className="flex-1">
                    <Input label="New team" placeholder="e.g. Marketing" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button type="submit" disabled={create.isPending || !name.trim()}>
                    {create.isPending ? 'Creating…' : 'Create'}
                </Button>
            </form>
            {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}


            {teams && teams.length > 0 ? (
                <ul className="mt-4 space-y-2">
                    {teams.map((t) => (
                        <li key={t.id}>
                            <Link to={`/teams/${t.id}`}>
                                <Card className="flex items-center justify-between hover:border-brand">
                                    <span className="font-medium text-ink">{t.name}</span>
                                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${roleColor[t.role] ?? ''}`}>
                                        {t.role}
                                    </span>
                                </Card>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-sm text-muted">
                    You don't have any teams yet.
                </p>
            )}
        </div>
    )
}