/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_ADMIN_API_KEY?: string;
  readonly VITE_DEMO_TENANT_ID?: string;
  readonly VITE_WIDGET_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
