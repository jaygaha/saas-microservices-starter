// type the custom env var
interface ImportMetaEnv {
    readonly VITE_APP_TITLE?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}