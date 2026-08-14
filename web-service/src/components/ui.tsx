import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

export function Button({
    variant = 'primary',
    className = '',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
    const base =
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ' +
        'transition disabled:opacity-50 disabled:cursor-not-allowed'
    const styles = {
        primary: 'bg-brand text-white hover:opacity-90',
        ghost: 'text-ink hover:bg-canvas border border-line',
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
