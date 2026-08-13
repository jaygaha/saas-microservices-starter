
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { listTeams } from '../lib/auth'
import { Card, Spinner } from '../components/ui'

const roleColor: Record<string, string> = {
    owner: 'bg-brand/10 text-brand',
    admin: 'bg-brand/10 text-brand',
    member: 'bg-gray-100 text-ink',
    viewer: 'bg-gray-100 text-muted',
}

export function Teams() {
    const { data: teams, isLoading, error } = useQuery({
        queryKey: ['teams'],
        queryFn: () => listTeams(),
    })

    if (isLoading) return <Spinner />
    if (error) return <p className="text-sm text-red-600">Could not load teams.</p>

    return (
        <div>
            <h1 className="text-xl font-semibold text-ink">Your teams</h1>
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