/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LEGAL_OPERATOR_NAME?: string
  readonly VITE_LEGAL_OPERATOR_ADDRESS?: string
  readonly VITE_LEGAL_CONTACT_EMAIL?: string
  readonly VITE_LEGAL_OPERATOR_DETAILS?: string
  readonly VITE_ANILIST_ENABLED?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
