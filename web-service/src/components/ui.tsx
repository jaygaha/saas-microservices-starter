import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { useEffect } from 'react'

export function Button({
    variant = 'primary',
    className = '',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
    const base =
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ' +
        'transition disabled:opacity-50 disabled:cursor-not-allowed'
    const styles = {
        primary: 'bg-brand text-white hover:opacity-90',
        ghost: 'text-ink hover:bg-canvas border border-line',
        danger: 'bg-red-600 text-white hover:opacity-90',
    }
    return <button className={`${base} ${styles[variant]} ${className}`} {...props} />
}

export function Input({
    label,
    className = '',
    ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
    return (
        <label className="block">
            {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
            <input
                className={
                    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm ' +
                    'outline-none focus:border-brand ' + className
                }
                {...props}
            />
        </label>
    )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`rounded-lg border border-line bg-surface p-6 shadow-sm ${className}`}>
            {children}
        </div>
    )
}

export function Spinner() {
    return <div className="grid min-h-[40vh] place-items-center text-sm text-muted">Loading…</div>
}

export function Select({
    label,
    className = '',
    children,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
    return (
        <label className="block">
            {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
            <select
                className={
                    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm ' +
                    'outline-none focus:border-brand ' + className
                }
                {...props}
            >
                {children}
            </select>
        </label>
    )
}

export function Modal({
    onClose,
    title,
    children,
}: {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
}) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-base font-semibold text-ink">{title}</h2>
                <div className="mt-4">{children}</div>
            </div>
        </div>
    )
}

export function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    danger = false,
    busy = false,
    onConfirm,
    onClose,
}: {
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    busy?: boolean
    onConfirm: () => void
    onClose: () => void
}) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <p className="text-sm text-muted">{message}</p>
            <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                <Button type="button" variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
                    {busy ? 'Working…' : confirmLabel}
                </Button>
            </div>
        </Modal>
    )
}