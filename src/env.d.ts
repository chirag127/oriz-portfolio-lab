/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_CF_BEACON_TOKEN?: string
  readonly PUBLIC_ENABLE_CF_ANALYTICS?: string
  readonly PUBLIC_WEB3FORMS_KEY?: string
  readonly PUBLIC_BUTTONDOWN_USERNAME?: string
  readonly PUBLIC_GA4_ID?: string
  readonly PUBLIC_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
