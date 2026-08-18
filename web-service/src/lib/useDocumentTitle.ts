// per-route titles
import { useEffect } from 'react'

const APP_NAME = import.meta.env.VITE_APP_TITLE ?? 'Task Manager SaaS'

// "Page · App", or just App when no page is given.
export function useDocumentTitle(pageTitle: string | null | undefined) {
    useEffect(() => {
        document.title = pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME
    }, [pageTitle])
}

