import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getBoard } from '../lib/boards'
import { Card } from '../components/ui'

export function BoardDetail() {
    const { teamId = '', boardId = '' } = useParams();
    const { data: board, isLoading, error } = useQuery({
        queryKey: ['board', boardId],
        queryFn: () => getBoard(boardId),
        enabled: !!boardId,
    })
    if (isLoading) return <p className="text-sm text-muted">Loading…</p>

    if (error) return <p className="text-sm text-red-600">Error loading board: {error.message}</p>

    if (!board) return <p className="text-sm text-red-600">Board not found, or you don't have access.</p>

    return (
        <div className="space-y-4">
            <Link to={`/teams/${teamId}`} className="text-sm text-muted hover:text-brand">← Back to team</Link>
            <h1 className="text-xl font-semibold text-ink">{board?.name}</h1>
            <Card><p className="text-sm text-muted">Tasks board (WIP).</p></Card>
        </div>
    )
}
